/**
 * Privilege Interceptor — records Dataverse Web API calls and maps them to
 * D365 security privilege types.
 *
 * Usage:
 *   const interceptor = new PrivilegeInterceptor(page);
 *   await interceptor.record('Create Case', async () => {
 *     const r = await xrmCreate(page, 'incident', { title: 'test' });
 *   });
 *   console.log(interceptor.formatMatrix());
 *   interceptor.detach();
 *
 * ─── LIMITATIONS ──────────────────────────────────────────────────────────────
 * • Privilege DEPTH (Basic / Local / Deep / Global) cannot be inferred from
 *   API calls.  Use the companion validation spec to confirm scope levels.
 * • `Assign` and `Share` operations require dedicated API calls (not plain CRUD)
 *   and are not currently detected.
 * • Background UCI reads may appear if the page is not in a stable state when
 *   recording starts.  Use `waitForXrm()` before the first recorded step.
 */

import type { Page, BrowserContext } from '@playwright/test';

// ─── Entity registry ──────────────────────────────────────────────────────────
//
// Maps OData entity set names (collection names used in URLs) to:
//   logical  – Dataverse logical entity name (used in Xrm.WebApi calls)
//   priv     – fragment used in privilege names  (e.g. "Account" → prvCreateAccount)
//
// Custom solution entities (msdyn_, bshcs_, …) use the full logical name in
// privilege names; standard OOB entities use PascalCase schema names.

interface EntityMeta { logical: string; priv: string }

const ENTITY_SET_MAP: Record<string, EntityMeta> = {
  // ── OOB standard ──────────────────────────────────────────────────────────
  accounts:                         { logical: 'account',                       priv: 'Account' },
  contacts:                         { logical: 'contact',                       priv: 'Contact' },
  incidents:                        { logical: 'incident',                      priv: 'Incident' },
  tasks:                            { logical: 'task',                          priv: 'Task' },
  phonecalls:                       { logical: 'phonecall',                     priv: 'PhoneCall' },
  emails:                           { logical: 'email',                         priv: 'Email' },
  appointments:                     { logical: 'appointment',                   priv: 'Appointment' },
  annotations:                      { logical: 'annotation',                    priv: 'Annotation' },
  queues:                           { logical: 'queue',                         priv: 'Queue' },
  queueitems:                       { logical: 'queueitem',                     priv: 'QueueItem' },
  entitlements:                     { logical: 'entitlement',                   priv: 'Entitlement' },
  entitlementchannels:              { logical: 'entitlementchannel',            priv: 'EntitlementChannel' },
  products:                         { logical: 'product',                       priv: 'Product' },
  knowledgearticles:                { logical: 'knowledgearticle',              priv: 'KnowledgeArticle' },
  // ── Field Service (msdyn_) ────────────────────────────────────────────────
  msdyn_workorders:                 { logical: 'msdyn_workorder',               priv: 'msdyn_workorder' },
  msdyn_workorderservices:          { logical: 'msdyn_workorderservice',        priv: 'msdyn_workorderservice' },
  msdyn_workorderincidents:         { logical: 'msdyn_workorderincident',       priv: 'msdyn_workorderincident' },
  msdyn_customerassets:             { logical: 'msdyn_customerasset',           priv: 'msdyn_customerasset' },
  msdyn_functionallocations:        { logical: 'msdyn_functionallocation',      priv: 'msdyn_functionallocation' },
  msdyn_resourcerequirements:       { logical: 'msdyn_resourcerequirement',     priv: 'msdyn_resourcerequirement' },
  msdyn_liveconversations:          { logical: 'msdyn_liveconversation',        priv: 'msdyn_liveconversation' },
  msdyn_knowledgepersonalfilters:   { logical: 'msdyn_knowledgepersonalfilter', priv: 'msdyn_knowledgepersonalfilter' },
  // ── Universal Resource Scheduling (bookable*) ─────────────────────────────
  bookableresources:                { logical: 'bookableresource',              priv: 'BookableResource' },
  bookableresourcebookings:         { logical: 'bookableresourcebooking',       priv: 'BookableResourceBooking' },
  bookingstatuses:                  { logical: 'bookingstatus',                 priv: 'BookableResourceBookingStatus' },
  // ── BSH custom (bshcs_) ───────────────────────────────────────────────────
  bshcs_billingfunctionallocations: { logical: 'bshcs_billingfunctionallocation', priv: 'bshcs_billingfunctionallocation' },
  bshcs_repairbatches:              { logical: 'bshcs_repairbatch',             priv: 'bshcs_repairbatch' },
  bshcs_diagnosecodes:              { logical: 'bshcs_diagnosecode',            priv: 'bshcs_diagnosecode' },
  bshcs_casestatusmappings:         { logical: 'bshcs_casestatusmapping',       priv: 'bshcs_casestatusmapping' },
  bshcs_productdivisions:           { logical: 'bshcs_productdivision',         priv: 'bshcs_productdivision' },
};

// ─── Privilege types ──────────────────────────────────────────────────────────

export type PrivilegeOp = 'Create' | 'Read' | 'Write' | 'Delete' | 'Append' | 'AppendTo';
export const ALL_OPS: PrivilegeOp[] = ['Create', 'Read', 'Write', 'Delete', 'Append', 'AppendTo'];

export interface CapturedPrivilege {
  step: string;
  entitySet: string;
  logical: string;
  op: PrivilegeOp;
  url: string;
}

// ─── URL parser ───────────────────────────────────────────────────────────────

/** Regex that matches the OData entity set name from a Dataverse Web API URL. */
const DATAVERSE_URL_RE = /\/api\/data\/v[\d.]+\/([^/?($]+)/;

/**
 * Extract the entity set name from a Dataverse Web API URL.
 * Returns undefined for metadata/function/system URLs.
 */
function extractEntitySet(url: string): string | undefined {
  const m = url.match(DATAVERSE_URL_RE);
  if (!m) return undefined;
  const set = m[1];
  // Skip: capitalised = OData function (WhoAmI, EntityDefinitions, …)
  if (set[0] === set[0].toUpperCase()) return undefined;
  // Skip known noise
  if (NOISE_SETS.has(set)) return undefined;
  return set;
}

const NOISE_SETS = new Set([
  'systemusers', 'teams', 'businessunits', 'usersettings', 'savedqueries',
  'userquery', 'webresourceset', 'ribbonclientmetadataset', 'solutioncomponents',
  'publisheraddresses', 'publishers', 'solutions', 'workflows', 'plugintypes',
  'sdkmessages', 'sdkmessageprocessingsteps', 'roles', 'roleprivileges',
  'timezonedefinitions', 'timezonelocalizednames', 'currencies',
  'organizations', 'transactioncurrencies', 'importfiles', 'importjobs',
  'msdyn_systemusers', 'activitypointers', 'activityparties',
]);

/** True when the URL ends in /$ref (collection-navigation relationship link) */
const isRefUrl = (url: string) => url.includes('/$ref');

/**
 * Parse @odata.bind references from a JSON POST/PATCH body.
 * Returns the entity set names of referenced records.
 */
function parseOdataBindTargets(postData: string | null): string[] {
  if (!postData) return [];
  try {
    const obj = JSON.parse(postData) as Record<string, unknown>;
    return Object.keys(obj)
      .filter(k => k.endsWith('@odata.bind'))
      .map(k => {
        const val = obj[k] as string; // e.g. "/accounts(guid)"
        const m = val.match(/^\/([^(]+)/);
        return m ? m[1] : '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Core interceptor class ───────────────────────────────────────────────────

export class PrivilegeInterceptor {
  private captured: CapturedPrivilege[] = [];
  private currentStep = '';
  private handler: (req: import('@playwright/test').Request) => void;
  private ctx: BrowserContext;

  constructor(page: Page) {
    this.ctx = page.context();
    this.handler = (req) => this.onRequest(req);
    this.ctx.on('request', this.handler);
  }

  detach(): void {
    this.ctx.off('request', this.handler);
  }

  private onRequest(req: import('@playwright/test').Request): void {
    if (!this.currentStep) return;
    const url = req.url();
    const method = req.method().toUpperCase();

    const entitySet = extractEntitySet(url);
    if (!entitySet) return;

    const meta = ENTITY_SET_MAP[entitySet];
    const logical = meta?.logical ?? entitySet;
    const priv = meta?.priv ?? entitySet;

    const emit = (op: PrivilegeOp) => {
      this.captured.push({ step: this.currentStep, entitySet, logical, op, url });
    };

    if (isRefUrl(url)) {
      // /$ref → relationship navigation: Append on source, AppendTo on target
      emit('Append');
      return;
    }

    switch (method) {
      case 'GET':
        emit('Read');
        break;
      case 'POST':
        emit('Create');
        // @odata.bind in body → AppendTo on each referenced entity
        for (const targetSet of parseOdataBindTargets(req.postData())) {
          const targetMeta = ENTITY_SET_MAP[targetSet];
          if (!targetMeta) continue;
          this.captured.push({
            step: this.currentStep,
            entitySet: targetSet,
            logical: targetMeta.logical,
            op: 'AppendTo',
            url,
          });
          // The source entity also needs Append when linking to another
          emit('Append');
        }
        break;
      case 'PATCH':
        emit('Write');
        for (const targetSet of parseOdataBindTargets(req.postData())) {
          const targetMeta = ENTITY_SET_MAP[targetSet];
          if (!targetMeta) continue;
          this.captured.push({
            step: this.currentStep,
            entitySet: targetSet,
            logical: targetMeta.logical,
            op: 'AppendTo',
            url,
          });
          emit('Append');
        }
        break;
      case 'DELETE':
        emit('Delete');
        break;
    }
  }

  /** Set the current step label (used in manual recording mode). */
  setStep(stepName: string): void {
    this.currentStep = stepName;
  }

  /** Wrap a step function — all API calls during `fn()` are attributed to `stepName`. */
  async record<T>(stepName: string, fn: () => Promise<T>): Promise<T> {
    this.currentStep = stepName;
    try {
      return await fn();
    } finally {
      this.currentStep = '';
    }
  }

  // ─── Reporting ─────────────────────────────────────────────────────────────

  /**
   * Returns deduplicated privileges per entity across all steps.
   * Shape: entity logical name → Set<PrivilegeOp>
   */
  aggregateByEntity(): Map<string, { meta: EntityMeta | null; ops: Set<PrivilegeOp> }> {
    const out = new Map<string, { meta: EntityMeta | null; ops: Set<PrivilegeOp> }>();
    for (const c of this.captured) {
      if (!out.has(c.logical)) {
        out.set(c.logical, {
          meta: ENTITY_SET_MAP[c.entitySet] ?? null,
          ops: new Set(),
        });
      }
      out.get(c.logical)!.ops.add(c.op);
    }
    return out;
  }

  /** Suggested privilege names in `prvCreateAccount` format. */
  suggestedPrivileges(): string[] {
    const names = new Set<string>();
    for (const [, { meta, ops }] of this.aggregateByEntity()) {
      const priv = meta?.priv ?? 'Unknown';
      for (const op of ops) {
        names.add(`prv${op}${priv}`);
      }
    }
    return [...names].sort();
  }

  /** Full per-step privilege table (for debugging / evidence). */
  stepTable(): string {
    if (this.captured.length === 0) return '  (no API calls captured)';
    const byStep = new Map<string, Map<string, Set<PrivilegeOp>>>();
    for (const c of this.captured) {
      if (!byStep.has(c.step)) byStep.set(c.step, new Map());
      const stepMap = byStep.get(c.step)!;
      if (!stepMap.has(c.logical)) stepMap.set(c.logical, new Set());
      stepMap.get(c.logical)!.add(c.op);
    }
    const lines: string[] = [];
    for (const [step, entities] of byStep) {
      lines.push(`\nStep: ${step}`);
      for (const [entity, ops] of entities) {
        lines.push(`  ${entity.padEnd(40)} ${[...ops].join(', ')}`);
      }
    }
    return lines.join('\n');
  }

  /** Markdown privilege matrix table (entity × operation). */
  formatMatrix(): string {
    const W = 80;
    const LINE = '═'.repeat(W);
    const DIV = '─'.repeat(W);
    const agg = this.aggregateByEntity();

    const header = '  Entity'.padEnd(44) + ALL_OPS.map(o => o.padEnd(10)).join('');
    const rows = [...agg.entries()].map(([logical, { ops }]) => {
      const cells = ALL_OPS.map(op => (ops.has(op) ? '✓' : ' ').padEnd(10)).join('');
      return `  ${logical.padEnd(42)} ${cells}`;
    });

    const privs = this.suggestedPrivileges();
    const privLines = privs.map(p => `  ${p}`);

    return [
      LINE,
      '  PRIVILEGE MATRIX — BSH CC Agent Recording (Admin API baseline)',
      DIV,
      '  ⚠️  Depth (Basic/Local/Deep/Global) not shown — validate separately.',
      '  ⚠️  Assign and Share operations require dedicated steps — not detected here.',
      DIV,
      header,
      DIV,
      ...rows,
      DIV,
      '  SUGGESTED PRIVILEGE NAMES FOR SECURITY ROLE XML:',
      DIV,
      ...privLines,
      LINE,
    ].join('\n');
  }

  /** Returns the full captured log as a JSON-serialisable array. */
  rawLog(): CapturedPrivilege[] {
    return [...this.captured];
  }
}
