// ============================================================================
//  DEVLET BUTCESI VE CIFT TARAFLI MUHASEBE - Faz 20
//  --------------------------------------------------------------------------
//  Legacy "points" komutan alt hesaplarinda tutulmaya devam eder; bu dosya
//  bunlarin toplam nakdini kanonik devlet hesabina baglar. Her parasal hareket
//  sifir toplamli journal postings uretir. Sessiz negatif bakiye yoktur.
// ============================================================================

const STORY_BUDGET_SCHEMA_VERSION = 1;
const STORY_BUDGET_ADAPTER_VERSION = 'story-state-budget-ledger-1';
const STORY_BUDGET_JOURNAL_LIMIT = 1400;
const STORY_BUDGET_SETTLEMENT_SCALE = 0.01;
const STORY_BUDGET_POLICY = Object.freeze({
    currency: 'STATE_CREDIT',
    legacyPointAdapter: 'COMMANDER_SUBACCOUNTS',
    settlementScale: STORY_BUDGET_SETTLEMENT_SCALE,
    baseAnnualInterestBps: 500,
    maxAnnualInterestBps: 3000,
    annualPrincipalServiceBps: 200,
    debtCeilingRevenueMultipleBps: 25000,
    minimumDebtCeiling: 1200,
    defaultMissedDays: 60,
    journalLimit: STORY_BUDGET_JOURNAL_LIMIT
});
const STORY_BUDGET_POLICY_HASH = typeof storyProductionHash === 'function'
    ? storyProductionHash({
        schemaVersion: STORY_BUDGET_SCHEMA_VERSION,
        adapterVersion: STORY_BUDGET_ADAPTER_VERSION,
        policy: STORY_BUDGET_POLICY
    })
    : 'story-budget-policy-1';

function storyBudgetEnabled() {
    return (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('economy.stateBudget'))
        && (typeof storyMarketEnabled !== 'function' || storyMarketEnabled());
}

function storyBudgetClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyBudgetRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const factor = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * factor) / factor;
}

function storyBudgetCountryId(value) {
    if (value && typeof value === 'object') value = value.id;
    return String(value).startsWith('country:') ? String(value) : `country:${Number(value)}`;
}

function storyBudgetState(value) {
    if (value && typeof value === 'object' && Number.isInteger(Number(value.id))) return value;
    const match = /^country:(\d+)$/.exec(String(value));
    const id = match ? Number(match[1]) : Number(value);
    return typeof storyState === 'function' ? storyState(id) : (STORY.states || [])[id];
}

function storyBudgetCommanders(st) {
    return st && typeof storyStateCommanders === 'function'
        ? storyStateCommanders(st).filter(Boolean)
        : [];
}

function storyBudgetWalletCash(st) {
    return storyBudgetRound(storyBudgetCommanders(st).reduce(
        (total, commander) => total + Math.max(0, Number(commander.res && commander.res.points) || 0),
        0
    ));
}

function storyBudgetAccount(country, accountId) {
    if (!country.accounts[accountId]) country.accounts[accountId] = 0;
    return country.accounts[accountId];
}

function storyBudgetCountryCreate(st) {
    const openingCash = storyBudgetWalletCash(st);
    return {
        id: storyBudgetCountryId(st.id),
        stateId: st.id,
        currency: STORY_BUDGET_POLICY.currency,
        status: 'CURRENT',
        accounts: {
            'ASSET:CASH': openingCash,
            'ASSET:TRADE_ESCROW': 0,
            'LIABILITY:DEBT': 0,
            'EQUITY:OPENING': -openingCash,
            'CONTRA:MONEY_ISSUED': 0
        },
        journal: [{
            id: `budget:${st.id}:0`,
            sequence: 0,
            at: storyBudgetRound(STORY.clock),
            source: 'opening.balance',
            correlationId: `budget-opening:${st.id}`,
            postings: [
                { account: 'ASSET:CASH', amount: openingCash },
                { account: 'EQUITY:OPENING', amount: -openingCash }
            ]
        }],
        transactionSequence: 0,
        totals: {
            revenue: 0,
            expense: 0,
            interestPaid: 0,
            interestCapitalized: 0,
            principalPaid: 0,
            debtIssued: 0,
            moneyIssued: 0,
            tradePaid: 0,
            tradeReceived: 0,
            rejectedSpending: 0
        },
        recent: {
            revenue: 0,
            expense: 0,
            lastAnnualRevenue: 0,
            lastAnnualExpense: 0,
            windowStartedAt: storyBudgetRound(STORY.clock)
        },
        arrears: 0,
        missedPaymentDays: 0,
        annualInterestBps: STORY_BUDGET_POLICY.baseAnnualInterestBps,
        lastTickAt: storyBudgetRound(STORY.clock),
        diagnostics: {
            reconciliations: 0,
            unauthorizedDelta: 0,
            warnings: []
        }
    };
}

function storyBudgetLedgerCreate(options) {
    const countries = {};
    for (const st of (STORY.states || [])) {
        countries[storyBudgetCountryId(st.id)] = storyBudgetCountryCreate(st);
        storyBudgetSyncMirror(st);
    }
    return {
        schemaVersion: STORY_BUDGET_SCHEMA_VERSION,
        adapterVersion: STORY_BUDGET_ADAPTER_VERSION,
        policyHash: STORY_BUDGET_POLICY_HASH,
        tickSequence: 0,
        settlementSequence: 0,
        lastTickAt: storyBudgetRound(STORY.clock),
        countries,
        settlements: [],
        diagnostics: {
            backfilled: !!(options && options.backfilled),
            restoredFromInvalidLedger: !!(options && options.restoredFromInvalidLedger),
            issues: storyBudgetClone(options && options.issues || []),
            warnings: storyBudgetClone(options && options.warnings || [])
        }
    };
}

function storyBudgetValidate(ledger, options) {
    options = options || {};
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return { ok: false, issues: [{ code: 'BUDGET_LEDGER_REQUIRED', path: '$', message: 'Butce defteri zorunlu.' }] };
    }
    if (ledger.schemaVersion !== STORY_BUDGET_SCHEMA_VERSION) add('BUDGET_SCHEMA_VERSION', '$.schemaVersion', 'Butce sema surumu uyusmuyor.');
    if (ledger.adapterVersion !== STORY_BUDGET_ADAPTER_VERSION) add('BUDGET_ADAPTER_VERSION', '$.adapterVersion', 'Butce adapteri uyusmuyor.');
    if (ledger.policyHash !== STORY_BUDGET_POLICY_HASH) add('BUDGET_POLICY_HASH', '$.policyHash', 'Butce politikasi uyusmuyor.');
    if (!ledger.countries || typeof ledger.countries !== 'object') add('BUDGET_COUNTRIES_REQUIRED', '$.countries', 'Ulke butceleri zorunlu.');
    if (!Array.isArray(ledger.settlements)) add('BUDGET_SETTLEMENTS_ARRAY', '$.settlements', 'Uzlasma listesi dizi olmali.');
    if (issues.length) return { ok: false, issues };

    for (const st of (STORY.states || [])) {
        const countryId = storyBudgetCountryId(st.id);
        const country = ledger.countries[countryId];
        if (!country) {
            add('BUDGET_COUNTRY_MISSING', `$.countries.${countryId}`, 'Ulke butcesi eksik.');
            continue;
        }
        for (const account of ['ASSET:CASH', 'ASSET:TRADE_ESCROW', 'LIABILITY:DEBT', 'CONTRA:MONEY_ISSUED']) {
            if (!Number.isFinite(Number(country.accounts && country.accounts[account]))) {
                add('BUDGET_ACCOUNT_INVALID', `$.countries.${countryId}.accounts.${account}`, 'Hesap bakiyesi sonlu olmali.');
            }
        }
        if (Number(country.accounts['ASSET:CASH']) < -1e-6) add('BUDGET_NEGATIVE_CASH', `$.countries.${countryId}.accounts.ASSET:CASH`, 'Nakit negatif olamaz.');
        if (Number(country.accounts['ASSET:TRADE_ESCROW']) < -1e-6) add('BUDGET_NEGATIVE_ESCROW', `$.countries.${countryId}.accounts.ASSET:TRADE_ESCROW`, 'Bloke nakit negatif olamaz.');
        for (let i = 0; i < (country.journal || []).length; i++) {
            const tx = country.journal[i];
            const total = (tx.postings || []).reduce((sum, posting) => sum + Number(posting.amount || 0), 0);
            if (Math.abs(total) > 1e-5) add('BUDGET_UNBALANCED_TRANSACTION', `$.countries.${countryId}.journal[${i}]`, `Fis dengede degil: ${total}`);
        }
        if (options.checkWalletMirrors) {
            const walletCash = storyBudgetWalletCash(st);
            const ledgerCash = storyBudgetRound(country.accounts['ASSET:CASH']);
            if (Math.abs(walletCash - ledgerCash) > 1e-4) {
                add('BUDGET_WALLET_MISMATCH', `$.countries.${countryId}.accounts.ASSET:CASH`, `Cuzdan toplami ${walletCash}, defter ${ledgerCash}.`);
            }
            if (Math.abs((Number(st.res && st.res.points) || 0) - ledgerCash) > 1e-4) {
                add('BUDGET_STATE_MIRROR_MISMATCH', `$.countries.${countryId}.accounts.ASSET:CASH`, 'State.res.points nakit aynasi degil.');
            }
        }
    }
    const activeEscrow = {};
    const activeCompanyEscrow = {};
    for (let i = 0; i < ledger.settlements.length; i++) {
        const settlement = ledger.settlements[i];
        const at = `$.settlements[${i}]`;
        if (!settlement || !['RESERVED', 'SETTLED', 'RELEASED'].includes(settlement.status)) {
            add('BUDGET_SETTLEMENT_STATUS', `${at}.status`, 'Uzlasma durumu gecersiz.');
            continue;
        }
        if (!Number.isFinite(Number(settlement.amount)) || Number(settlement.amount) < 0) {
            add('BUDGET_SETTLEMENT_AMOUNT', `${at}.amount`, 'Uzlasma tutari negatif olmayan sonlu sayi olmali.');
        }
        if (settlement.status === 'RESERVED') {
            if (settlement.payerType === 'COMPANY' && settlement.buyerCompanyId) {
                activeCompanyEscrow[settlement.buyerCompanyId] = storyBudgetRound(
                    (activeCompanyEscrow[settlement.buyerCompanyId] || 0)
                        + Number(settlement.amount || 0)
                );
            } else {
                activeEscrow[settlement.buyerCountryId] = storyBudgetRound(
                    (activeEscrow[settlement.buyerCountryId] || 0) + Number(settlement.amount || 0)
                );
            }
        }
    }
    for (const [countryId, country] of Object.entries(ledger.countries)) {
        const booked = storyBudgetRound(country.accounts['ASSET:TRADE_ESCROW']);
        const active = storyBudgetRound(activeEscrow[countryId] || 0);
        if (Math.abs(booked - active) > 1e-4) {
            add('BUDGET_ESCROW_MISMATCH', `$.countries.${countryId}.accounts.ASSET:TRADE_ESCROW`, `Bloke hesap ${booked}, aktif uzlasma ${active}.`);
        }
    }
    if (typeof storyCompanyById === 'function') {
        const companyIds = new Set(Object.keys(activeCompanyEscrow));
        for (const company of Object.values(
            STORY.companyEconomy && STORY.companyEconomy.companies || {}
        )) {
            if (company && company.accounts && company.accounts['ASSET:TRADE_ESCROW'] != null) {
                companyIds.add(company.id);
            }
        }
        for (const companyId of companyIds) {
            const company = storyCompanyById(companyId);
            const active = storyBudgetRound(activeCompanyEscrow[companyId] || 0);
            const booked = storyBudgetRound(
                Number(company && company.accounts && company.accounts['ASSET:TRADE_ESCROW']) || 0
            );
            if (Math.abs(booked - active) > 1e-4) {
                add('BUDGET_COMPANY_ESCROW_MISMATCH', `$.settlements.${companyId}`,
                    `Sirket bloke hesabi ${booked}, aktif uzlasma ${active}.`);
            }
        }
    }
    return { ok: issues.length === 0, issues };
}

function storyBudgetReset(options) {
    if (!storyBudgetEnabled()) {
        STORY.stateBudget = null;
        return null;
    }
    STORY.stateBudget = storyBudgetLedgerCreate(options);
    return STORY.stateBudget;
}

function storyBudgetRestore(saved) {
    if (!storyBudgetEnabled()) {
        STORY.stateBudget = null;
        return null;
    }
    if (!saved) return storyBudgetReset({
        backfilled: true,
        warnings: ['Kayit devlet butcesi tasimiyordu; mevcut komutan cuzdanlarindan acilis bakiyesi kuruldu.']
    });
    const candidate = storyBudgetClone(saved);
    const validation = storyBudgetValidate(candidate);
    if (!validation.ok) return storyBudgetReset({
        backfilled: true,
        restoredFromInvalidLedger: true,
        issues: validation.issues,
        warnings: ['Gecersiz butce defteri kullanilmadi; mevcut cuzdanlardan yeniden kuruldu.']
    });
    STORY.stateBudget = candidate;
    return STORY.stateBudget;
}

function storyBudgetEnsure() {
    if (!storyBudgetEnabled()) return null;
    if (!STORY.stateBudget) return storyBudgetReset({ backfilled: true });
    return STORY.stateBudget;
}

function storyBudgetCountry(value) {
    const ledger = storyBudgetEnsure();
    return ledger && ledger.countries[storyBudgetCountryId(value)];
}

function storyBudgetSyncMirror(st) {
    if (!st) return 0;
    const cash = storyBudgetWalletCash(st);
    if (!st.res) st.res = { oil: 0, manpower: 0, points: 0 };
    st.res.points = cash;
    return cash;
}

function storyBudgetPost(country, source, postings, meta) {
    if (!country || !Array.isArray(postings) || postings.length < 2) return { ok: false, code: 'INVALID_POSTING' };
    const clean = postings.map(posting => ({
        account: String(posting.account),
        amount: storyBudgetRound(posting.amount)
    })).filter(posting => Math.abs(posting.amount) > 1e-9);
    const total = storyBudgetRound(clean.reduce((sum, posting) => sum + posting.amount, 0));
    if (clean.length < 2 || Math.abs(total) > 1e-5) return { ok: false, code: 'UNBALANCED_POSTING', imbalance: total };
    country.transactionSequence++;
    const tx = {
        id: `budget:${country.stateId}:${country.transactionSequence}`,
        sequence: country.transactionSequence,
        at: storyBudgetRound(STORY.clock),
        source: String(source || 'unspecified'),
        correlationId: meta && meta.correlationId != null ? String(meta.correlationId) : null,
        settlementId: meta && meta.settlementId != null ? String(meta.settlementId) : null,
        postings: clean
    };
    for (const posting of clean) {
        storyBudgetAccount(country, posting.account);
        country.accounts[posting.account] = storyBudgetRound(country.accounts[posting.account] + posting.amount);
    }
    country.journal.push(tx);
    if (country.journal.length > STORY_BUDGET_JOURNAL_LIMIT) {
        country.journal.splice(0, country.journal.length - STORY_BUDGET_JOURNAL_LIMIT);
    }
    return { ok: true, transaction: tx };
}

function storyBudgetDistributeCredit(st, amount, options) {
    const cmds = storyBudgetCommanders(st);
    if (!cmds.length) return false;
    const target = options && options.commander;
    if (target && cmds.includes(target)) {
        if (!target.res) target.res = { oil: 0, manpower: 0, points: 0 };
        target.res.points = storyBudgetRound((Number(target.res.points) || 0) + amount);
        return true;
    }
    const weight = options && typeof options.weight === 'function' ? options.weight : (() => 1);
    let totalWeight = cmds.reduce((sum, commander) => sum + Math.max(0, Number(weight(commander)) || 0), 0);
    if (totalWeight <= 0) totalWeight = cmds.length;
    let allocated = 0;
    cmds.forEach((commander, index) => {
        if (!commander.res) commander.res = { oil: 0, manpower: 0, points: 0 };
        const share = index === cmds.length - 1
            ? storyBudgetRound(amount - allocated)
            : storyBudgetRound(amount * (Math.max(0, Number(weight(commander)) || 0) || 1) / totalWeight);
        commander.res.points = storyBudgetRound((Number(commander.res.points) || 0) + share);
        allocated = storyBudgetRound(allocated + share);
    });
    return true;
}

function storyBudgetRemoveCash(st, amount, options) {
    const cmds = storyBudgetCommanders(st);
    if (!cmds.length) return false;
    const preferred = options && options.commander;
    const ordered = preferred && cmds.includes(preferred)
        ? [preferred].concat(cmds.filter(item => item !== preferred).sort((a, b) => Number(b.res && b.res.points) - Number(a.res && a.res.points)))
        : cmds.slice().sort((a, b) => Number(b.res && b.res.points) - Number(a.res && a.res.points));
    if (preferred && options && options.commanderOnly && Number(preferred.res && preferred.res.points) + 1e-6 < amount) return false;
    let remaining = amount;
    for (const commander of ordered) {
        if (remaining <= 1e-7) break;
        if (!commander.res) continue;
        const available = Math.max(0, Number(commander.res.points) || 0);
        const take = Math.min(remaining, available);
        commander.res.points = storyBudgetRound(available - take);
        remaining = storyBudgetRound(remaining - take);
        if (preferred && options && options.commanderOnly) break;
    }
    return remaining <= 1e-5;
}

function storyBudgetCredit(stateOrId, amount, source, options) {
    const st = storyBudgetState(stateOrId);
    const value = storyBudgetRound(Math.max(0, Number(amount) || 0));
    if (!st || value <= 0) return { ok: false, code: 'INVALID_CREDIT' };
    if (!storyBudgetEnabled()) {
        storyBudgetDistributeCredit(st, value, options);
        storyBudgetSyncMirror(st);
        return { ok: true, legacy: true, amount: value };
    }
    const country = storyBudgetCountry(st);
    storyBudgetReconcileCountry(st, 'before.credit');
    if (!country || !storyBudgetDistributeCredit(st, value, options)) return { ok: false, code: 'CREDIT_TARGET_MISSING' };
    const revenueAccount = `REVENUE:${String(source || 'unspecified').toUpperCase()}`;
    const posted = storyBudgetPost(country, source, [
        { account: 'ASSET:CASH', amount: value },
        { account: revenueAccount, amount: -value }
    ], options);
    if (!posted.ok) return posted;
    country.totals.revenue = storyBudgetRound(country.totals.revenue + value);
    country.recent.revenue = storyBudgetRound(country.recent.revenue + value);
    storyBudgetSyncMirror(st);
    return { ok: true, amount: value, transaction: posted.transaction };
}

function storyBudgetDebit(stateOrId, amount, source, options) {
    const st = storyBudgetState(stateOrId);
    const value = storyBudgetRound(Math.max(0, Number(amount) || 0));
    if (!st || value <= 0) return { ok: false, code: 'INVALID_DEBIT' };
    if (storyBudgetEnabled()) storyBudgetReconcileCountry(st, 'before.debit');
    const liveCash = storyBudgetWalletCash(st);
    if (liveCash + 1e-6 < value) {
        const country = storyBudgetCountry(st);
        if (country) country.totals.rejectedSpending++;
        return { ok: false, code: 'INSUFFICIENT_CASH', available: liveCash, required: value };
    }
    if (!storyBudgetEnabled()) {
        if (!storyBudgetRemoveCash(st, value, options)) return { ok: false, code: 'INSUFFICIENT_CASH' };
        storyBudgetSyncMirror(st);
        return { ok: true, legacy: true, amount: value };
    }
    const country = storyBudgetCountry(st);
    if (!country || !storyBudgetRemoveCash(st, value, options)) return { ok: false, code: 'DEBIT_TARGET_MISSING' };
    const expenseAccount = `EXPENSE:${String(source || 'unspecified').toUpperCase()}`;
    const posted = storyBudgetPost(country, source, [
        { account: expenseAccount, amount: value },
        { account: 'ASSET:CASH', amount: -value }
    ], options);
    if (!posted.ok) return posted;
    country.totals.expense = storyBudgetRound(country.totals.expense + value);
    country.recent.expense = storyBudgetRound(country.recent.expense + value);
    storyBudgetSyncMirror(st);
    return { ok: true, amount: value, transaction: posted.transaction };
}

function storyBudgetTransfer(stateOrId, fromCommander, toCommander, amount, source, options) {
    const st = storyBudgetState(stateOrId);
    const value = storyBudgetRound(Math.max(0, Number(amount) || 0));
    if (!st || !fromCommander || !toCommander || value <= 0) return { ok: false, code: 'INVALID_TRANSFER' };
    if (Number(fromCommander.res && fromCommander.res.points) + 1e-6 < value) return { ok: false, code: 'INSUFFICIENT_CASH' };
    fromCommander.res.points = storyBudgetRound(Number(fromCommander.res.points) - value);
    if (!toCommander.res) toCommander.res = { oil: 0, manpower: 0, points: 0 };
    toCommander.res.points = storyBudgetRound((Number(toCommander.res.points) || 0) + value);
    const country = storyBudgetCountry(st);
    const posted = country ? storyBudgetPost(country, source || 'internal.transfer', [
        { account: `MEMO:TRANSFER_TO:${toCommander.id}`, amount: value },
        { account: `MEMO:TRANSFER_FROM:${fromCommander.id}`, amount: -value }
    ], options) : null;
    storyBudgetSyncMirror(st);
    return { ok: true, amount: value, transaction: posted && posted.transaction || null };
}

function storyBudgetFundCommander(stateOrId, toCommander, amount, source, options) {
    const st = storyBudgetState(stateOrId);
    const value = storyBudgetRound(Math.max(0, Number(amount) || 0));
    if (!st || !toCommander || value <= 0 || storyBudgetWalletCash(st) + 1e-6 < value) {
        return { ok: false, code: 'INSUFFICIENT_CASH' };
    }
    if (!storyBudgetRemoveCash(st, value)) return { ok: false, code: 'INSUFFICIENT_CASH' };
    storyBudgetDistributeCredit(st, value, { commander: toCommander });
    const country = storyBudgetCountry(st);
    if (country) storyBudgetPost(country, source || 'internal.funding', [
        { account: `MEMO:FUND_TO:${toCommander.id}`, amount: value },
        { account: 'MEMO:FUND_FROM_POOL', amount: -value }
    ], options);
    storyBudgetSyncMirror(st);
    return { ok: true, amount: value };
}

function storyBudgetCountryTransfer(fromStateOrId, toStateOrId, amount, source, options) {
    const from = storyBudgetState(fromStateOrId);
    const to = storyBudgetState(toStateOrId);
    const value = storyBudgetRound(Math.max(0, Number(amount) || 0));
    if (!from || !to || from.id === to.id || value <= 0) return { ok: false, code: 'INVALID_COUNTRY_TRANSFER' };
    const ledger = storyBudgetEnsure();
    const settlementId = `budget-transfer:${ledger ? ++ledger.settlementSequence : Math.floor(STORY.clock)}`;
    const paid = storyBudgetDebit(from, value, `${source || 'transfer'}.out`, Object.assign({}, options, { settlementId }));
    if (!paid.ok) return paid;
    const received = storyBudgetCredit(to, value, `${source || 'transfer'}.in`, Object.assign({}, options, { settlementId }));
    if (!received.ok) {
        storyBudgetCredit(from, value, 'transfer.rollback', Object.assign({}, options, { settlementId }));
        return { ok: false, code: 'TRANSFER_CREDIT_FAILED' };
    }
    return { ok: true, amount: value, settlementId };
}

function storyBudgetDebtCeiling(country) {
    const annualizedRevenue = Math.max(
        Number(country.recent && country.recent.revenue) || 0,
        Number(country.recent && country.recent.lastAnnualRevenue) || 0
    );
    return storyBudgetRound(Math.max(
        STORY_BUDGET_POLICY.minimumDebtCeiling,
        annualizedRevenue * STORY_BUDGET_POLICY.debtCeilingRevenueMultipleBps / 10000
    ));
}

function storyBudgetIssueDebt(stateOrId, amount, source, options) {
    const st = storyBudgetState(stateOrId);
    const country = storyBudgetCountry(st);
    const value = storyBudgetRound(Math.max(0, Number(amount) || 0));
    if (!st || !country || value <= 0 || country.status === 'DEFAULT') return { ok: false, code: 'DEBT_NOT_AVAILABLE' };
    const debt = Math.max(0, -Number(country.accounts['LIABILITY:DEBT']) || 0);
    const ceiling = storyBudgetDebtCeiling(country);
    if (debt + value > ceiling + 1e-6) return { ok: false, code: 'DEBT_CEILING', debt, ceiling, requested: value };
    storyBudgetDistributeCredit(st, value, options);
    const posted = storyBudgetPost(country, source || 'debt.issue', [
        { account: 'ASSET:CASH', amount: value },
        { account: 'LIABILITY:DEBT', amount: -value }
    ], options);
    country.totals.debtIssued = storyBudgetRound(country.totals.debtIssued + value);
    storyBudgetSyncMirror(st);
    return { ok: true, amount: value, transaction: posted.transaction };
}

function storyBudgetPrintMoney(stateOrId, amount, source, options) {
    const st = storyBudgetState(stateOrId);
    const country = storyBudgetCountry(st);
    const value = storyBudgetRound(Math.max(0, Number(amount) || 0));
    if (!st || !country || value <= 0) return { ok: false, code: 'INVALID_ISSUANCE' };
    storyBudgetDistributeCredit(st, value, options);
    const posted = storyBudgetPost(country, source || 'money.issue', [
        { account: 'ASSET:CASH', amount: value },
        { account: 'CONTRA:MONEY_ISSUED', amount: -value }
    ], options);
    country.totals.moneyIssued = storyBudgetRound(country.totals.moneyIssued + value);
    const beforeCash = Math.max(1, Number(country.accounts['ASSET:CASH']) - value);
    const pressure = Math.min(5, value / beforeCash * 3);
    st.inflation = Math.min(30, Math.max(2, (Number(st.inflation) || 2) + pressure));
    st.marketConfidence = Math.max(0, (Number(st.marketConfidence) || 50) - Math.min(8, pressure * 1.5));
    storyBudgetSyncMirror(st);
    return { ok: true, amount: value, transaction: posted.transaction };
}

function storyBudgetTradeAmount(sourceRegionId, targetRegionId, resourceId, quantity) {
    const quote = typeof storyMarketTradeQuote === 'function'
        ? storyMarketTradeQuote(sourceRegionId, targetRegionId, resourceId, quantity)
        : null;
    if (!quote || !Number.isFinite(Number(quote.indexedNotional))) return { ok: false, code: 'PRICE_QUOTE_UNAVAILABLE' };
    return {
        ok: true,
        amount: storyBudgetRound(Math.max(0.01, Number(quote.indexedNotional) * STORY_BUDGET_SETTLEMENT_SCALE)),
        quote: Object.assign({}, quote, {
            currency: STORY_BUDGET_POLICY.currency,
            settlementScale: STORY_BUDGET_SETTLEMENT_SCALE
        })
    };
}

function storyBudgetTrimSettlements(ledger) {
    if (!ledger || ledger.settlements.length <= 800) return;
    const removable = ledger.settlements
        .map((item, index) => ({ item, index }))
        .filter(row => row.item.status !== 'RESERVED')
        .slice(0, ledger.settlements.length - 800)
        .map(row => row.index);
    for (let i = removable.length - 1; i >= 0; i--) {
        ledger.settlements.splice(removable[i], 1);
    }
}

function storyBudgetReserveTrade(order, quantity) {
    if (!storyBudgetEnabled() || order.sellerCountryId === order.buyerCountryId) {
        return { ok: true, internal: true, amount: 0, reservationId: null };
    }
    const priced = storyBudgetTradeAmount(order.sourceRegionId, order.targetRegionId, order.resourceId, quantity);
    if (!priced.ok) return priced;
    const companyPayer = typeof storyCommerceEnabled === 'function'
        && storyCommerceEnabled()
        && order.buyerCompanyId
        && order.sellerCompanyId
        && typeof storyCompanyReserveTradePayment === 'function';
    if (companyPayer) {
        const reserved = storyCompanyReserveTradePayment(
            order.buyerCompanyId,
            priced.amount,
            { correlationId: order.id, resourceId: order.resourceId }
        );
        if (!reserved.ok) return {
            ok: false,
            code: 'TRADE_FINANCE_DENIED',
            finance: reserved
        };
        const ledger = storyBudgetEnsure();
        ledger.settlementSequence++;
        const reservationId = `budget-settlement:${ledger.settlementSequence}`;
        const settlement = {
            id: reservationId,
            status: 'RESERVED',
            payerType: 'COMPANY',
            orderId: order.id,
            shipmentId: null,
            sellerCountryId: order.sellerCountryId,
            buyerCountryId: order.buyerCountryId,
            sellerCompanyId: order.sellerCompanyId || null,
            buyerCompanyId: String(order.buyerCompanyId),
            resourceId: order.resourceId,
            quantity: storyBudgetRound(quantity),
            amount: priced.amount,
            currency: STORY_BUDGET_POLICY.currency,
            quote: priced.quote,
            reservedAt: storyBudgetRound(STORY.clock),
            settledAt: null,
            releasedAt: null
        };
        ledger.settlements.push(settlement);
        storyBudgetTrimSettlements(ledger);
        return { ok: true, amount: priced.amount, reservationId, settlement, quote: priced.quote };
    }
    const buyer = storyBudgetState(order.buyerCountryId);
    const country = storyBudgetCountry(buyer);
    if (!buyer || !country) return { ok: false, code: 'BUYER_BUDGET_MISSING' };
    let cash = storyBudgetWalletCash(buyer);
    if (cash + 1e-6 < priced.amount) {
        const debt = storyBudgetIssueDebt(buyer, storyBudgetRound(priced.amount - cash), 'trade.working_capital', {
            correlationId: order.id
        });
        if (!debt.ok) return { ok: false, code: 'TRADE_FINANCE_DENIED', finance: debt };
        cash = storyBudgetWalletCash(buyer);
    }
    if (cash + 1e-6 < priced.amount || !storyBudgetRemoveCash(buyer, priced.amount)) {
        return { ok: false, code: 'TRADE_CASH_UNAVAILABLE' };
    }
    const ledger = storyBudgetEnsure();
    ledger.settlementSequence++;
    const reservationId = `budget-settlement:${ledger.settlementSequence}`;
    const posted = storyBudgetPost(country, 'trade.reserve', [
        { account: 'ASSET:TRADE_ESCROW', amount: priced.amount },
        { account: 'ASSET:CASH', amount: -priced.amount }
    ], { correlationId: order.id, settlementId: reservationId });
    if (!posted.ok) return posted;
    const settlement = {
        id: reservationId,
        status: 'RESERVED',
        payerType: 'STATE',
        orderId: order.id,
        shipmentId: null,
        sellerCountryId: order.sellerCountryId,
        buyerCountryId: order.buyerCountryId,
        sellerCompanyId: order.sellerCompanyId || null,
        buyerCompanyId: order.buyerCompanyId || null,
        resourceId: order.resourceId,
        quantity: storyBudgetRound(quantity),
        amount: priced.amount,
        currency: STORY_BUDGET_POLICY.currency,
        quote: priced.quote,
        reservedAt: storyBudgetRound(STORY.clock),
        settledAt: null,
        releasedAt: null
    };
    ledger.settlements.push(settlement);
    storyBudgetTrimSettlements(ledger);
    storyBudgetSyncMirror(buyer);
    return { ok: true, amount: priced.amount, reservationId, settlement, quote: priced.quote };
}

function storyBudgetBindTradeShipment(reservationId, shipmentId) {
    if (!reservationId) return true;
    const ledger = storyBudgetEnsure();
    const settlement = ledger && ledger.settlements.find(item => item.id === reservationId);
    if (!settlement || settlement.status !== 'RESERVED') return false;
    settlement.shipmentId = String(shipmentId);
    return true;
}

function storyBudgetAttachLegacyTradeReservations() {
    if (!storyBudgetEnabled() || !STORY.tradeLogistics) return { attached: 0, held: 0 };
    let attached = 0;
    let held = 0;
    for (const shipment of (STORY.tradeLogistics.shipments || [])) {
        if (!['IN_TRANSIT', 'HELD'].includes(shipment.status)
            || shipment.sellerCountryId === shipment.buyerCountryId
            || shipment.settlementReservationId) continue;
        const order = (STORY.tradeLogistics.orders || []).find(item => item.id === shipment.orderId) || shipment;
        if (!order.sellerCompanyId && typeof storyCompanySellerForTrade === 'function') {
            order.sellerCompanyId = storyCompanySellerForTrade(order.sourceRegionId, order.resourceId);
        }
        if (!shipment.sellerCompanyId) shipment.sellerCompanyId = order.sellerCompanyId || null;
        const reserved = storyBudgetReserveTrade(order, shipment.quantity);
        if (!reserved.ok) {
            shipment.status = 'HELD';
            shipment.holdReason = 'PAYMENT_RESERVATION_REQUIRED';
            held++;
            continue;
        }
        shipment.settlementReservationId = reserved.reservationId;
        shipment.settlementAmount = storyBudgetRound(reserved.amount);
        shipment.priceQuote = reserved.quote ? storyBudgetClone(reserved.quote) : null;
        storyBudgetBindTradeShipment(reserved.reservationId, shipment.id);
        attached++;
    }
    if (STORY.tradeLogistics.diagnostics) {
        STORY.tradeLogistics.diagnostics.priceSettlementActive = true;
        if (attached || held) STORY.tradeLogistics.diagnostics.warnings = [
            `Faz 20 oncesi aktif dis ticaret yuku: ${attached} bloke edildi, ${held} odeme bekliyor.`
        ].concat(STORY.tradeLogistics.diagnostics.warnings || []).slice(0, 30);
    }
    return { attached, held };
}

function storyBudgetReleaseTrade(reservationId, reason) {
    if (!reservationId) return { ok: true, internal: true };
    const ledger = storyBudgetEnsure();
    const settlement = ledger && ledger.settlements.find(item => item.id === reservationId);
    if (!settlement || settlement.status !== 'RESERVED') return { ok: false, code: 'RESERVATION_NOT_ACTIVE' };
    if (settlement.payerType === 'COMPANY' && settlement.buyerCompanyId) {
        const released = typeof storyCompanyReleaseTradePayment === 'function'
            ? storyCompanyReleaseTradePayment(
                settlement.buyerCompanyId,
                settlement.amount,
                { correlationId: settlement.orderId, settlementId: settlement.id }
            )
            : { ok: false, code: 'COMPANY_TRADE_RELEASE_UNAVAILABLE' };
        if (!released.ok) return released;
        settlement.status = 'RELEASED';
        settlement.releaseReason = String(reason || 'RELEASED');
        settlement.releasedAt = storyBudgetRound(STORY.clock);
        return { ok: true, settlement };
    }
    const buyer = storyBudgetState(settlement.buyerCountryId);
    const country = storyBudgetCountry(buyer);
    storyBudgetDistributeCredit(buyer, settlement.amount);
    storyBudgetPost(country, 'trade.release', [
        { account: 'ASSET:CASH', amount: settlement.amount },
        { account: 'ASSET:TRADE_ESCROW', amount: -settlement.amount }
    ], { correlationId: settlement.orderId, settlementId: settlement.id });
    settlement.status = 'RELEASED';
    settlement.releaseReason = String(reason || 'RELEASED');
    settlement.releasedAt = storyBudgetRound(STORY.clock);
    storyBudgetSyncMirror(buyer);
    return { ok: true, settlement };
}

function storyBudgetSettleTrade(reservationId, details) {
    if (!reservationId) return { ok: true, internal: true };
    const ledger = storyBudgetEnsure();
    const settlement = ledger && ledger.settlements.find(item => item.id === reservationId);
    if (!settlement || settlement.status !== 'RESERVED') return { ok: false, code: 'RESERVATION_NOT_ACTIVE' };
    if (settlement.payerType === 'COMPANY' && settlement.buyerCompanyId) {
        const buyerCompany = typeof storyCompanyById === 'function'
            ? storyCompanyById(settlement.buyerCompanyId)
            : null;
        const sellerCompany = typeof storyCompanyById === 'function'
            ? storyCompanyById(settlement.sellerCompanyId)
            : null;
        if (!buyerCompany || !sellerCompany
            || typeof storyCompanySettleTradeImport !== 'function'
            || typeof storyCommercePostSellerSale !== 'function') {
            return { ok: false, code: 'SETTLEMENT_COMPANY_MISSING' };
        }
        if (Number(buyerCompany.accounts['ASSET:TRADE_ESCROW']) + 1e-6 < settlement.amount) {
            return { ok: false, code: 'SETTLEMENT_COMPANY_ESCROW_MISSING' };
        }
        const cargoCost = storyBudgetRound(Math.max(0, Number(details && details.cargoCost) || 0));
        const sold = storyCommercePostSellerSale(
            sellerCompany,
            settlement.amount,
            cargoCost,
            {
                correlationId: settlement.orderId,
                settlementId: settlement.id,
                buyerCompanyId: settlement.buyerCompanyId,
                buyerType: 'TRADE_IMPORT',
                resourceId: settlement.resourceId
            }
        );
        if (!sold.ok) return sold;
        const imported = storyCompanySettleTradeImport(
            settlement.buyerCompanyId,
            settlement.amount,
            {
                correlationId: settlement.orderId,
                settlementId: settlement.id,
                resourceId: settlement.resourceId,
                quantity: settlement.quantity
            }
        );
        if (!imported.ok) return imported;
        sellerCompany.cumulative.tradeRevenue = storyBudgetRound(
            (Number(sellerCompany.cumulative.tradeRevenue) || 0) + settlement.amount
        );
        settlement.payerId = settlement.buyerCompanyId;
        settlement.payeeType = 'COMPANY';
        settlement.payeeId = settlement.sellerCompanyId;
        settlement.costAmount = sold.costAmount;
        settlement.status = 'SETTLED';
        settlement.settledAt = storyBudgetRound(STORY.clock);
        return { ok: true, settlement };
    }
    const buyer = storyBudgetState(settlement.buyerCountryId);
    const buyerBudget = storyBudgetCountry(buyer);
    const seller = storyBudgetState(settlement.sellerCountryId);
    const sellerBudget = storyBudgetCountry(seller);
    const companySettlement = settlement.sellerCompanyId
        && typeof storyCompanyReceiveTradePayment === 'function';
    if (companySettlement && typeof storyCompanyById === 'function'
        && !storyCompanyById(settlement.sellerCompanyId)) {
        return { ok: false, code: 'SETTLEMENT_COMPANY_MISSING' };
    }
    if (!buyer || !buyerBudget || (!companySettlement && (!seller || !sellerBudget))) {
        return { ok: false, code: 'SETTLEMENT_COUNTRY_MISSING' };
    }
    storyBudgetPost(buyerBudget, 'trade.import', [
        { account: 'EXPENSE:TRADE_IMPORT', amount: settlement.amount },
        { account: 'ASSET:TRADE_ESCROW', amount: -settlement.amount }
    ], { correlationId: settlement.orderId, settlementId: settlement.id });
    buyerBudget.totals.expense = storyBudgetRound(buyerBudget.totals.expense + settlement.amount);
    buyerBudget.totals.tradePaid = storyBudgetRound(buyerBudget.totals.tradePaid + settlement.amount);
    if (companySettlement) {
        const received = storyCompanyReceiveTradePayment(
            settlement.sellerCompanyId,
            settlement.amount,
            { correlationId: settlement.orderId, settlementId: settlement.id }
        );
        if (!received.ok) return received;
    } else {
        storyBudgetDistributeCredit(seller, settlement.amount);
        storyBudgetPost(sellerBudget, 'trade.export', [
            { account: 'ASSET:CASH', amount: settlement.amount },
            { account: 'REVENUE:TRADE_EXPORT', amount: -settlement.amount }
        ], { correlationId: settlement.orderId, settlementId: settlement.id });
        sellerBudget.totals.revenue = storyBudgetRound(sellerBudget.totals.revenue + settlement.amount);
        sellerBudget.totals.tradeReceived = storyBudgetRound(sellerBudget.totals.tradeReceived + settlement.amount);
        storyBudgetSyncMirror(seller);
    }
    settlement.payeeType = companySettlement ? 'COMPANY' : 'STATE';
    settlement.payeeId = companySettlement ? settlement.sellerCompanyId : settlement.sellerCountryId;
    settlement.status = 'SETTLED';
    settlement.settledAt = storyBudgetRound(STORY.clock);
    storyBudgetSyncMirror(buyer);
    return { ok: true, settlement };
}

function storyBudgetReconcileCountry(st, reason) {
    const country = storyBudgetCountry(st);
    if (!country) return null;
    const live = storyBudgetWalletCash(st);
    const booked = storyBudgetRound(country.accounts['ASSET:CASH']);
    const delta = storyBudgetRound(live - booked);
    if (Math.abs(delta) <= 1e-5) {
        storyBudgetSyncMirror(st);
        return { ok: true, delta: 0 };
    }
    storyBudgetPost(country, 'legacy.reconciliation', [
        { account: 'ASSET:CASH', amount: delta },
        { account: delta > 0 ? 'REVENUE:UNAUTHORIZED_LEGACY' : 'EXPENSE:UNAUTHORIZED_LEGACY', amount: -delta }
    ], { correlationId: String(reason || 'budget-tick') });
    country.diagnostics.reconciliations++;
    country.diagnostics.unauthorizedDelta = storyBudgetRound(country.diagnostics.unauthorizedDelta + delta);
    country.diagnostics.warnings = [`Kanonik kapi disi points degisimi yakalandi: ${delta}`].concat(country.diagnostics.warnings || []).slice(0, 20);
    storyBudgetSyncMirror(st);
    return { ok: false, delta };
}

function storyBudgetReconcileAll(reason) {
    if (!storyBudgetEnabled()) return [];
    return (STORY.states || []).map(st => storyBudgetReconcileCountry(st, reason));
}

function storyBudgetTick(dtSec) {
    const ledger = storyBudgetEnsure();
    if (!ledger) return { disabled: true };
    const secondsPerYear = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120
        : 120;
    const daysPerYear = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.daysPerYear) || 360
        : 360;
    const worldDays = Math.max(0, Number(dtSec) || 0) * daysPerYear / secondsPerYear;
    storyBudgetReconcileAll('budget.tick');
    for (const st of (STORY.states || [])) {
        const country = storyBudgetCountry(st);
        if (!country) continue;
        if (STORY.clock - Number(country.recent.windowStartedAt || 0) >= secondsPerYear) {
            country.recent.lastAnnualRevenue = storyBudgetRound(country.recent.revenue);
            country.recent.lastAnnualExpense = storyBudgetRound(country.recent.expense);
            country.recent.revenue = 0;
            country.recent.expense = 0;
            country.recent.windowStartedAt = storyBudgetRound(STORY.clock);
        }
        if (country.arrears > 1e-7) {
            const arrearsPayment = Math.min(country.arrears, Math.max(0, storyBudgetWalletCash(st) - 200));
            if (arrearsPayment > 0 && storyBudgetRemoveCash(st, arrearsPayment)) {
                storyBudgetPost(country, 'debt.arrears_payment', [
                    { account: 'LIABILITY:DEBT', amount: arrearsPayment },
                    { account: 'ASSET:CASH', amount: -arrearsPayment }
                ], { correlationId: `budget-tick:${ledger.tickSequence + 1}` });
                country.arrears = storyBudgetRound(Math.max(0, country.arrears - arrearsPayment));
                country.totals.principalPaid = storyBudgetRound(country.totals.principalPaid + arrearsPayment);
                if (country.arrears <= 1e-7) country.missedPaymentDays = 0;
                storyBudgetSyncMirror(st);
            }
        }
        const debt = Math.max(0, -Number(country.accounts['LIABILITY:DEBT']) || 0);
        const revenue = Math.max(1, Number(country.totals.revenue) || 0);
        const debtRatio = debt / revenue;
        country.annualInterestBps = Math.round(Math.min(
            STORY_BUDGET_POLICY.maxAnnualInterestBps,
            STORY_BUDGET_POLICY.baseAnnualInterestBps + debtRatio * 1200 + (country.status === 'DEFAULT' ? 1000 : 0)
        ));
        if (debt > 1e-7 && worldDays > 0) {
            const interest = storyBudgetRound(debt * country.annualInterestBps / 10000 * worldDays / daysPerYear);
            if (interest > 0) {
                const paid = storyBudgetDebit(st, interest, 'debt.interest', { correlationId: `budget-tick:${ledger.tickSequence + 1}` });
                if (paid.ok) {
                    country.totals.interestPaid = storyBudgetRound(country.totals.interestPaid + interest);
                    country.missedPaymentDays = Math.max(0, storyBudgetRound(country.missedPaymentDays - worldDays * 0.5));
                } else {
                    storyBudgetPost(country, 'debt.interest_capitalized', [
                        { account: 'EXPENSE:DEBT_INTEREST', amount: interest },
                        { account: 'LIABILITY:DEBT', amount: -interest }
                    ], { correlationId: `budget-tick:${ledger.tickSequence + 1}` });
                    country.totals.expense = storyBudgetRound(country.totals.expense + interest);
                    country.recent.expense = storyBudgetRound(country.recent.expense + interest);
                    country.totals.interestCapitalized = storyBudgetRound(country.totals.interestCapitalized + interest);
                    country.arrears = storyBudgetRound(country.arrears + interest);
                    country.missedPaymentDays = storyBudgetRound(country.missedPaymentDays + worldDays);
                }
            }
            const principalDue = storyBudgetRound(debt * STORY_BUDGET_POLICY.annualPrincipalServiceBps / 10000 * worldDays / daysPerYear);
            const spareCash = Math.max(0, storyBudgetWalletCash(st) - 200);
            const principal = Math.min(principalDue, spareCash);
            if (principal > 0 && storyBudgetRemoveCash(st, principal)) {
                storyBudgetPost(country, 'debt.principal', [
                    { account: 'LIABILITY:DEBT', amount: principal },
                    { account: 'ASSET:CASH', amount: -principal }
                ], { correlationId: `budget-tick:${ledger.tickSequence + 1}` });
                country.totals.principalPaid = storyBudgetRound(country.totals.principalPaid + principal);
                storyBudgetSyncMirror(st);
            }
        }
        if (country.missedPaymentDays >= STORY_BUDGET_POLICY.defaultMissedDays) country.status = 'DEFAULT';
        else if (country.status === 'DEFAULT' && country.missedPaymentDays <= 0 && country.arrears <= 0) country.status = 'CURRENT';
        country.lastTickAt = storyBudgetRound(STORY.clock);
    }
    ledger.tickSequence++;
    ledger.lastTickAt = storyBudgetRound(STORY.clock);
    return { disabled: false, tickSequence: ledger.tickSequence, worldDays };
}

function storyBudgetCountryView(value) {
    const country = storyBudgetCountry(value);
    if (!country) return null;
    return {
        schemaVersion: STORY_BUDGET_SCHEMA_VERSION,
        adapterVersion: STORY_BUDGET_ADAPTER_VERSION,
        countryId: country.id,
        currency: country.currency,
        status: country.status,
        cash: storyBudgetRound(country.accounts['ASSET:CASH']),
        tradeEscrow: storyBudgetRound(country.accounts['ASSET:TRADE_ESCROW']),
        debt: storyBudgetRound(Math.max(0, -Number(country.accounts['LIABILITY:DEBT']) || 0)),
        moneyIssued: storyBudgetRound(Math.max(0, -Number(country.accounts['CONTRA:MONEY_ISSUED']) || 0)),
        debtCeiling: storyBudgetDebtCeiling(country),
        annualInterestBps: country.annualInterestBps,
        arrears: storyBudgetRound(country.arrears),
        missedPaymentDays: storyBudgetRound(country.missedPaymentDays),
        totals: storyBudgetClone(country.totals),
        recentTransactions: storyBudgetClone((country.journal || []).slice(-20))
    };
}

function storyBudgetSummary() {
    const ledger = storyBudgetEnsure();
    if (!ledger) return {
        schemaVersion: STORY_BUDGET_SCHEMA_VERSION,
        adapterVersion: STORY_BUDGET_ADAPTER_VERSION,
        disabled: true
    };
    const countries = Object.values(ledger.countries);
    const companyTradeEscrow = ledger.settlements
        .filter(item => item.status === 'RESERVED' && item.payerType === 'COMPANY')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        countryCount: countries.length,
        totalCash: storyBudgetRound(countries.reduce((sum, item) => sum + Number(item.accounts['ASSET:CASH'] || 0), 0)),
        totalEscrow: storyBudgetRound(countries.reduce((sum, item) => sum + Number(item.accounts['ASSET:TRADE_ESCROW'] || 0), 0)),
        companyTradeEscrow: storyBudgetRound(companyTradeEscrow),
        totalDebt: storyBudgetRound(countries.reduce((sum, item) => sum + Math.max(0, -Number(item.accounts['LIABILITY:DEBT'] || 0)), 0)),
        totalMoneyIssued: storyBudgetRound(countries.reduce((sum, item) => sum + Math.max(0, -Number(item.accounts['CONTRA:MONEY_ISSUED'] || 0)), 0)),
        defaultedCountries: countries.filter(item => item.status === 'DEFAULT').map(item => item.id),
        activeReservations: ledger.settlements.filter(item => item.status === 'RESERVED').length,
        companyFundedReservations: ledger.settlements.filter(
            item => item.status === 'RESERVED' && item.payerType === 'COMPANY'
        ).length,
        settledTrades: ledger.settlements.filter(item => item.status === 'SETTLED').length,
        diagnostics: storyBudgetClone(ledger.diagnostics)
    };
}

function storyBudgetForSave() {
    const ledger = storyBudgetEnsure();
    if (!ledger) return null;
    storyBudgetReconcileAll('budget.save');
    const validation = storyBudgetValidate(ledger, { checkWalletMirrors: true });
    ledger.diagnostics.issues = validation.ok ? [] : validation.issues.slice(0, 50);
    return storyBudgetClone(ledger);
}
