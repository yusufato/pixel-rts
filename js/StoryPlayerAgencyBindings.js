// Grounded player-action adapters. Registration alone never fabricates domain state.
function storyPlayerAgencyGovernanceInput(input) {
    const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
    const regionId=storyPlayerAgencyRegionId(input);
    return {view:{actorId:ctx.actorId||null},regionId};
}
function storyPlayerAgencyActorId(input) {
    const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
    return String(input&&input.actorId||ctx.actorId||'');
}
function storyPlayerAgencyInfrastructureDefault(mode) {
    const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
    const owned=(STORY.nodes||[]).filter(node=>ctx.st&&Number(node.owner)===Number(ctx.st.id));
    const works=STORY.infrastructureWorks||{};
    const key=`${mode}:${ctx.countryId}:${Object.keys(works.commands||{}).length}:${Object.keys(works.proposals||{}).length}`;
    if(STORY._playerAgencyInfrastructureDefault&&STORY._playerAgencyInfrastructureDefault.key===key){
        return STORY._playerAgencyInfrastructureDefault.value;
    }
    let value=null,checked=0;
    for(let i=0;i<owned.length&&!value;i++)for(let j=i+1;j<owned.length&&!value;j++){
        if(checked++>=24)break;
        const fromRegionId=`region:${owned[i].id}`,toRegionId=`region:${owned[j].id}`;
        const resolved=typeof storyInfrastructureRoutePlayerSpec==='function'
            ?storyInfrastructureRoutePlayerSpec(fromRegionId,toRegionId,mode):null;
        if(resolved&&resolved.ok&&(!resolved.candidate||resolved.candidate.ok))value={fromRegionId,toRegionId,resolved};
    }
    STORY._playerAgencyInfrastructureDefault={key,value};
    return value;
}function storyPlayerAgencyRegionId(input) {
    const st=typeof storyPlayerState==='function'?storyPlayerState():null;
    const owned=(STORY.nodes||[]).filter(node=>st&&Number(node.owner)===Number(st.id));
    const remembered=String(STORY._governanceRegionId||'');
    const selected=owned.find(node=>Number(node.id)===Number(STORY.selectedNodeId));
    const fallback=owned[0];
    return String(input&&input.regionId
        ||(owned.some(node=>`region:${node.id}`===remembered)?remembered:'')
        ||(selected&&`region:${selected.id}`)
        ||(fallback&&`region:${fallback.id}`)||'');
}
storyPlayerAgencyRegister({
    familyId:'INVESTMENT',actionId:'PUBLIC_WORKS',name:'Kamu yatirimi baslat',
    owner:'StoryGovernance.storyGovernanceSubmit',
    preview(input){
        const ctx=storyPlayerAgencyGovernanceInput(input);
        let action=typeof storyGovernanceActionView==='function'
            ?storyGovernanceActionView('PUBLIC_WORKS',ctx.regionId):null;
        if(!(input&&input.regionId)&&action&&!action.allowed){
            const st=typeof storyPlayerState==='function'?storyPlayerState():null;
            const candidates=(STORY.nodes||[]).filter(node=>st&&Number(node.owner)===Number(st.id));
            for(const node of candidates){
                const candidate=storyGovernanceActionView('PUBLIC_WORKS',`region:${node.id}`);
                if(candidate&&candidate.allowed){ctx.regionId=`region:${node.id}`;action=candidate;break;}
            }
        }
        return {
            allowed:!!(action&&action.allowed),code:action&&action.allowed?'READY':'GOVERNANCE_LOCKED',
            reasons:action&&action.reasons||['Yonetim motoru kullanilamiyor.'],
            actorId:ctx.view&&ctx.view.actorId||null,
            authoritySource:action&&action.institution&&action.institution.id||'EXECUTIVE',
            cost:action&&action.cost||{points:120},regionId:ctx.regionId
        };
    },
    execute(input,preview){
        const result=storyGovernanceSubmit('PUBLIC_WORKS',preview.regionId);
        return result&&result.ok
            ?{ok:true,worldMutation:true,canonicalReceipt:{requestId:result.request.id,ledger:'institutions',resultType:'REGION_LEVEL_UP'}}
            :{ok:false,code:result&&result.reason||result&&result.status||'PUBLIC_WORKS_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'MILITARY_STRATEGY',actionId:'MOBILIZE_RESERVE',name:'Yerel ihtiyati seferber et',
    owner:'StoryGovernance.storyGovernanceSubmit',
    preview(input){
        const ctx=storyPlayerAgencyGovernanceInput(input);
        let action=typeof storyGovernanceActionView==='function'
            ?storyGovernanceActionView('MOBILIZE_RESERVE',ctx.regionId):null;
        if(!(input&&input.regionId)&&action&&!action.allowed){
            const st=typeof storyPlayerState==='function'?storyPlayerState():null;
            const candidates=(STORY.nodes||[]).filter(node=>st&&Number(node.owner)===Number(st.id));
            for(const node of candidates){
                const candidate=storyGovernanceActionView('MOBILIZE_RESERVE',`region:${node.id}`);
                if(candidate&&candidate.allowed){ctx.regionId=`region:${node.id}`;action=candidate;break;}
            }
        }
        return {
            allowed:!!(action&&action.allowed),code:action&&action.allowed?'READY':'GOVERNANCE_LOCKED',
            reasons:action&&action.reasons||['Yonetim motoru kullanilamiyor.'],
            actorId:ctx.view&&ctx.view.actorId||null,
            authoritySource:action&&action.institution&&action.institution.id||'ARMED_FORCES',
            cost:action&&action.cost||{manpower:70},regionId:ctx.regionId
        };
    },
    execute(input,preview){
        const result=storyGovernanceSubmit('MOBILIZE_RESERVE',preview.regionId);
        return result&&result.ok
            ?{ok:true,worldMutation:true,canonicalReceipt:{requestId:result.request.id,ledger:'institutions',resultType:'REGION_GARRISON_UP'}}
            :{ok:false,code:result&&result.reason||result&&result.status||'MOBILIZATION_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'BUDGET',actionId:'ISSUE_DEBT',name:'Devlet tahvili ihrac et',
    owner:'StoryBudget.storyBudgetIssueDebt',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const amount=Math.max(1,Number(input&&input.amount)||50);
        const executive=(ctx.heldInstitutions||[]).find(row=>row.type==='EXECUTIVE');
        const country=ctx.country&&STORY.stateBudget&&STORY.stateBudget.countries
            &&STORY.stateBudget.countries[ctx.countryId];
        const ceiling=country&&typeof storyBudgetDebtCeiling==='function'?storyBudgetDebtCeiling(country):0;
        const debt=country?Math.max(0,-Number(country.accounts&&country.accounts['LIABILITY:DEBT'])||0):0;
        const reasons=[];
        if(!ctx.st||!executive)reasons.push('Yurutme makami gerekli.');
        if(debt+amount>ceiling)reasons.push('Borc tavani asiliyor.');
        return {allowed:reasons.length===0,code:reasons.length?'DEBT_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:executive&&executive.id||null,cost:{debt:amount},amount};
    },
    execute(input,preview){
        const result=storyBudgetIssueDebt(storyPlayerState(),preview.amount,'player.agency.debt',{
            actorId:preview.actorId,authoritySource:preview.authoritySource
        });
        return result&&result.ok
            ?{ok:true,worldMutation:true,canonicalReceipt:{transactionId:result.transaction&&result.transaction.id,ledger:'stateBudget',amount:result.amount}}
            :{ok:false,code:result&&result.code||'DEBT_ISSUE_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'BANKING',actionId:'REQUEST_COMPANY_LOAN',name:'Sirket kredisi kullan',
    owner:'StoryCompanies.storyCompanyRequestLoan',
    preview(input){
        const actor=typeof storyCharacterIdentityView==='function'
            ?storyCharacterIdentityView(storyPlayerAgencyActorId(input)):null;
        const company=actor&&['COMPANY_OWNER','COMPANY_EXECUTIVE'].includes(actor.role)&&typeof storyCompanyById==='function'
            ?storyCompanyById(actor.organizationId):null;
        const amount=Math.max(1,Number(input&&input.amount)||20);
        const bank=company&&STORY.companyEconomy&&STORY.companyEconomy.banks[company.bankId];
        const reasons=[];
        if(!actor||!['COMPANY_OWNER','COMPANY_EXECUTIVE'].includes(actor.role))reasons.push('Kanonik sirket sahibi veya yoneticisi gerekli.');
        if(!company)reasons.push('Oyuncuya bagli sirket bulunamadi.');
        if(company&&(!bank||bank.status!=='OPERATING'||Number(bank.reserves)<amount))reasons.push('Banka likiditesi yetersiz.');
        return {allowed:reasons.length===0,code:reasons.length?'LOAN_LOCKED':'READY',reasons,
            actorId:actor&&actor.id||null,authoritySource:company&&company.id||null,cost:{debt:amount},
            companyId:company&&company.id||null,amount};
    },
    execute(input,preview){
        const result=storyCompanyRequestLoan(preview.companyId,preview.amount,{
            correlationId:`player-agency:${storyPlayerAgencyEnsure().sequence+1}`
        });
        return result&&result.ok
            ?{ok:true,worldMutation:true,canonicalReceipt:{companyId:preview.companyId,bankId:result.bank.id,ledger:'companyEconomy',amount:result.amount}}
            :{ok:false,code:result&&result.code||'COMPANY_LOAN_FAILED'};
    }
});

storyPlayerAgencyRegister({
    familyId:'MARKET',actionId:'SET_SAFE_TARGET',name:'Stratejik stok hedefi belirle',
    owner:'StoryRegionalEconomy.storyRegionalSetSafeTarget',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const regionId=storyPlayerAgencyRegionId(input);
        const resourceId=String(input&&input.resourceId||'food');
        const region=typeof storyRegionalRegionView==='function'?storyRegionalRegionView(regionId):null;
        const executive=(ctx.heldInstitutions||[]).find(row=>row.type==='EXECUTIVE');
        const currentTarget=Number(region&&region.safeTargets[resourceId])||0;
        const quantity=Math.max(0,input&&Object.prototype.hasOwnProperty.call(input,'quantity')
            ?Number(input.quantity)||0:currentTarget+10);
        const reasons=[];
        if(!ctx.st||!executive)reasons.push('Yurutme makami gerekli.');
        if(!region)reasons.push('Gecerli hedef bolge gerekli.');
        if(typeof STORY_RESOURCE_IDS==='undefined'||!STORY_RESOURCE_IDS.includes(resourceId))reasons.push('Gecersiz kaynak.');
        return {allowed:reasons.length===0,code:reasons.length?'MARKET_POLICY_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:executive&&executive.id||null,cost:{administrative:1},
            regionId,resourceId,quantity};
    },
    execute(input,preview){
        const result=storyRegionalSetSafeTarget(preview.regionId,preview.resourceId,preview.quantity,{
            source:'PLAYER_MARKET_POLICY',actorId:preview.actorId
        });
        return result&&result.ok
            ?{ok:true,worldMutation:true,canonicalReceipt:{transactionId:result.transaction.id,ledger:'regionalEconomy',before:result.before,after:result.after}}
            :{ok:false,code:result&&result.code||'SAFE_TARGET_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'TRADE',actionId:'CREATE_AND_DISPATCH_ORDER',name:'Ticaret siparisi ve sevkiyati baslat',
    owner:'StoryTrade.storyTradeCreateOrder',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const executive=(ctx.heldInstitutions||[]).find(row=>row.type==='EXECUTIVE');
        const owned=(STORY.nodes||[]).filter(node=>ctx.st&&Number(node.owner)===Number(ctx.st.id));
        const sourceRegionId=String(input&&input.sourceRegionId||owned[0]&&`region:${owned[0].id}`||'');
        const targetRegionId=String(input&&input.targetRegionId||owned[1]&&`region:${owned[1].id}`||'');
        const resourceId=String(input&&input.resourceId||'food');
        const quantity=Math.max(0.01,Number(input&&input.quantity)||1);
        const source=typeof storyRegionalRegionView==='function'?storyRegionalRegionView(sourceRegionId):null;
        const reasons=[];
        if(!ctx.st||!executive)reasons.push('Yurutme makami gerekli.');
        if(!sourceRegionId||!targetRegionId||sourceRegionId===targetRegionId)reasons.push('Iki farkli bolge gerekli.');
        if(!source||Number(source.stocks&&source.stocks[resourceId])<quantity)reasons.push('Kaynak bolgede yeterli stok yok.');
        return {allowed:reasons.length===0,code:reasons.length?'TRADE_ORDER_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:executive&&executive.id||null,cost:{stock:quantity},
            sourceRegionId,targetRegionId,resourceId,quantity};
    },
    execute(input,preview){
        const created=storyTradeCreateOrder({sourceRegionId:preview.sourceRegionId,targetRegionId:preview.targetRegionId,
            resourceId:preview.resourceId,quantity:preview.quantity,priority:100,source:'PLAYER_ORDER'});
        if(!created||!created.ok)return {ok:false,code:created&&created.code||'ORDER_CREATE_FAILED'};
        const dispatched=storyTradeDispatchOrder(created.order.id,preview.quantity);
        if(!dispatched||!dispatched.ok)return {ok:false,code:dispatched&&dispatched.code||'ORDER_DISPATCH_FAILED'};
        return {ok:true,worldMutation:true,canonicalReceipt:{contractId:created.contract.id,orderId:created.order.id,
            shipmentId:dispatched.shipment&&dispatched.shipment.id||null,ledger:'tradeLogistics'}};
    }
});
storyPlayerAgencyRegister({
    familyId:'INFRASTRUCTURE',actionId:'BUILD_ROUTE',name:'Ulasim koridoru insa et',
    owner:'StoryInfrastructureWorks.storyInfrastructureRoutePlayerSubmitDraft',
    preview(input){
        const mode=String(input&&input.mode||'LAND').toUpperCase();
        const automatic=!(input&&input.fromRegionId&&input.toRegionId)
            ?storyPlayerAgencyInfrastructureDefault(mode):null;
        const fromRegionId=String(input&&input.fromRegionId||automatic&&automatic.fromRegionId||'');
        const toRegionId=String(input&&input.toRegionId||automatic&&automatic.toRegionId||'');
        const resolved=automatic&&automatic.fromRegionId===fromRegionId&&automatic.toRegionId===toRegionId
            ?automatic.resolved:(typeof storyInfrastructureRoutePlayerSpec==='function'
                ?storyInfrastructureRoutePlayerSpec(fromRegionId,toRegionId,mode):null);
        const reasons=[];
        if(!resolved||!resolved.ok)reasons.push(resolved&&resolved.code||'Rota onizlemesi kullanilamiyor.');
        if(resolved&&resolved.candidate&&!resolved.candidate.ok)reasons.push(...(resolved.candidate.blockReasons||[]));
        return {allowed:reasons.length===0,code:reasons.length?'ROUTE_LOCKED':'READY',reasons,
            actorId:resolved&&resolved.actor&&resolved.actor.actorId||null,
            authoritySource:resolved&&resolved.spec&&resolved.spec.ownerId||null,
            cost:resolved&&resolved.requirements||null,fromRegionId,toRegionId,mode};
    },
    execute(input,preview){
        const selected=storyInfrastructureRoutePlayerSelect(preview.fromRegionId,preview.toRegionId,preview.mode);
        if(!selected||!selected.ok)return {ok:false,code:selected&&selected.code||'ROUTE_SELECT_FAILED'};
        const result=storyInfrastructureRoutePlayerSubmitDraft();
        return result&&result.ok
            ?{ok:true,worldMutation:true,canonicalReceipt:{commandId:result.command&&result.command.id||null,
                proposalId:result.proposal&&result.proposal.id||null,ledger:'infrastructureWorks',mode:preview.mode}}
            :{ok:false,code:result&&result.code||'ROUTE_SUBMIT_FAILED'};
    }
});

storyPlayerAgencyRegister({
    familyId:'PRODUCTION',actionId:'SET_SECTOR_PRIORITY',name:'Bolgesel uretim onceligi belirle',
    owner:'StoryRegionalEconomy.storyRegionalSetSectorPriority',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const executive=(ctx.heldInstitutions||[]).find(row=>row.type==='EXECUTIVE');
        const regionId=storyPlayerAgencyRegionId(input);
        const sectorId=String(input&&input.sectorId||'agriculture');
        const reasons=[];
        if(!ctx.st||!executive)reasons.push('Yurutme makami gerekli.');
        if(!STORY.regionalEconomy||!STORY.regionalEconomy.regions[regionId])reasons.push('Gecerli bolge gerekli.');
        if(typeof STORY_PRODUCTION_SECTOR_IDS==='undefined'||!STORY_PRODUCTION_SECTOR_IDS.includes(sectorId))reasons.push('Gecersiz sektor.');
        return {allowed:reasons.length===0,code:reasons.length?'PRODUCTION_POLICY_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:executive&&executive.id||null,cost:{administrative:1},regionId,sectorId};
    },
    execute(input,preview){
        const result=storyRegionalSetSectorPriority(preview.regionId,preview.sectorId,{source:'PLAYER_PRODUCTION_POLICY',actorId:preview.actorId});
        return result&&result.ok?{ok:true,worldMutation:true,canonicalReceipt:{transactionId:result.transaction.id,
            ledger:'regionalEconomy',before:result.before,after:result.after}}:{ok:false,code:result&&result.code||'SECTOR_PRIORITY_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'LABOR',actionId:'SET_PARTICIPATION',name:'Emek katilim programi uygula',
    owner:'StoryPopulation.storyPopulationSetLaborParticipation',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const executive=(ctx.heldInstitutions||[]).find(row=>row.type==='EXECUTIVE');
        const regionId=storyPlayerAgencyRegionId(input);
        const requested=input&&Object.prototype.hasOwnProperty.call(input,'participationBps')
            ?Number(input.participationBps):10500;
        const participationBps=Math.max(5000,Math.min(11000,Math.round(requested||10000)));
        const reasons=[];
        if(!ctx.st||!executive)reasons.push('Yurutme makami gerekli.');
        if(!STORY.population||!STORY.population.regions[regionId])reasons.push('Gecerli bolge gerekli.');
        return {allowed:reasons.length===0,code:reasons.length?'LABOR_POLICY_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:executive&&executive.id||null,cost:{welfareRisk:Math.abs(participationBps-10000)},regionId,participationBps};
    },
    execute(input,preview){
        const result=storyPopulationSetLaborParticipation(preview.regionId,preview.participationBps,{actorId:preview.actorId});
        return result&&result.ok?{ok:true,worldMutation:true,canonicalReceipt:result.receipt}:{ok:false,code:result&&result.code||'LABOR_POLICY_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'COMPANY',actionId:'LOBBY_POLICY',name:'Sirket adina lobi faaliyeti yurut',
    owner:'StoryCompanies.storyCompanyLobby',
    preview(input){
        const actor=typeof storyCharacterIdentityView==='function'?storyCharacterIdentityView(storyPlayerAgencyActorId(input)):null;
        const company=actor&&['COMPANY_OWNER','COMPANY_EXECUTIVE'].includes(actor.role)&&typeof storyCompanyById==='function'?storyCompanyById(actor.organizationId):null;
        const amount=Math.max(1,Number(input&&input.amount)||10);
        const reasons=[];
        if(!actor||!['COMPANY_OWNER','COMPANY_EXECUTIVE'].includes(actor.role))reasons.push('Kanonik sirket sahibi veya yoneticisi gerekli.');
        if(!company)reasons.push('Oyuncuya bagli sirket bulunamadi.');
        if(company&&Number(company.accounts&&company.accounts['ASSET:CASH'])<amount)reasons.push('Sirket nakdi yetersiz.');
        return {allowed:reasons.length===0,code:reasons.length?'COMPANY_ACTION_LOCKED':'READY',reasons,
            actorId:actor&&actor.id||null,authoritySource:company&&company.id||null,cost:{companyCash:amount},
            companyId:company&&company.id||null,amount,target:String(input&&input.target||'ECONOMIC_POLICY')};
    },
    execute(input,preview){
        const result=storyCompanyLobby(preview.companyId,preview.amount,{target:preview.target,disclosed:true});
        return result&&result.ok?{ok:true,worldMutation:true,canonicalReceipt:{ledger:'companyEconomy',
            companyId:result.companyId,amount:result.amount,influence:result.influence}}:{ok:false,code:result&&result.code||'LOBBY_FAILED'};
    }
});

storyPlayerAgencyRegister({
    familyId:'MIGRATION',actionId:'PLANNED_RELOCATION',name:'Planli nufus yerlesimi uygula',
    owner:'StoryPopulation.storyPopulationTransferCohorts',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const executive=(ctx.heldInstitutions||[]).find(row=>row.type==='EXECUTIVE');
        const owned=(STORY.nodes||[]).filter(node=>ctx.st&&Number(node.owner)===Number(ctx.st.id));
        const originRegionId=String(input&&input.originRegionId||owned[0]&&`region:${owned[0].id}`||'');
        const destinationRegionId=String(input&&input.destinationRegionId||owned[1]&&`region:${owned[1].id}`||'');
        const origin=STORY.population&&STORY.population.regions[originRegionId];
        const people=Math.max(1,Math.floor(Number(input&&input.people)||100));
        const profileKey=String(input&&input.profileKey||origin&&origin.cohorts[0]&&origin.cohorts[0].profileKey||'');
        const reasons=[];
        if(!ctx.st||!executive)reasons.push('Yurutme makami gerekli.');
        if(!originRegionId||!destinationRegionId||originRegionId===destinationRegionId)reasons.push('Iki farkli bolge gerekli.');
        if(!origin||!origin.cohorts.some(row=>row.profileKey===profileKey&&row.membersPeople>=people))reasons.push('Tasinabilir kohort bulunamadi.');
        return {allowed:reasons.length===0,code:reasons.length?'MIGRATION_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:executive&&executive.id||null,cost:{people},originRegionId,destinationRegionId,profileKey,people};
    },
    execute(input,preview){
        const requested={};requested[preview.profileKey]=preview.people;
        const result=storyPopulationTransferCohorts(preview.originRegionId,preview.destinationRegionId,requested,{minimumOriginPopulationPeople:1000});
        return result&&result.ok?{ok:true,worldMutation:true,canonicalReceipt:{ledger:'population',
            originRegionId:result.originRegionId,destinationRegionId:result.destinationRegionId,movedPeople:result.movedPeople,cohorts:result.cohorts}}
            :{ok:false,code:result&&result.reason||'RELOCATION_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'POWER_CENTERS',actionId:'CONSULT_CENTER',name:'Guc merkeziyle resmi istisare yap',
    owner:'StoryPowerCenters.storyPowerCenterPlayerConsult',
    preview(input){
        const actorId=storyPlayerAgencyActorId(input);
        const actor=typeof storyCharacterIdentityView==='function'?storyCharacterIdentityView(actorId):null;
        const preferred={COMPANY_OWNER:'BUSINESS_COUNCIL',COMMANDER:'ARMED_FORCES',AGENT:'SECURITY_SERVICE',
            CIVILIAN:'LABOR_MOVEMENT',MAYOR:'CIVIL_SERVICE'}[actor&&actor.role];
        const centers=Object.values(STORY.powerCenters&&STORY.powerCenters.centers||{}).filter(row=>actor&&row.countryId===actor.countryId);
        const center=centers.find(row=>row.id===String(input&&input.centerId||''))
            ||centers.find(row=>row.type===preferred)
            ||centers.slice().sort((a,b)=>Number(b.influenceBps)-Number(a.influenceBps))[0];
        const allowedRoles={EXECUTIVE:null,COMPANY_OWNER:'BUSINESS_COUNCIL',COMMANDER:'ARMED_FORCES',AGENT:'SECURITY_SERVICE',
            CIVILIAN:'LABOR_MOVEMENT',MAYOR:'CIVIL_SERVICE'};
        const required=actor&&Object.prototype.hasOwnProperty.call(allowedRoles,actor.role)?allowedRoles[actor.role]:'DENIED';
        const reasons=[];
        if(!actor)reasons.push('Kanonik oyuncu karakteri gerekli.');
        if(!center)reasons.push('Ulke icinde etkin guc merkezi bulunamadi.');
        if(required==='DENIED'||(required&&center&&center.type!==required))reasons.push('Karakter rolu bu merkezle resmi istisare yetkisi vermiyor.');
        return {allowed:reasons.length===0,code:reasons.length?'POWER_CENTER_LOCKED':'READY',reasons,
            actorId,authoritySource:center&&center.id||null,cost:{politicalAttention:1},centerId:center&&center.id||null};
    },
    execute(input,preview){
        const result=storyPowerCenterPlayerConsult(preview.centerId,{actorId:preview.actorId});
        return result&&result.ok?{ok:true,worldMutation:true,canonicalReceipt:result.receipt}
            :{ok:false,code:result&&result.code||'CENTER_CONSULTATION_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'INSTITUTIONS',actionId:'RESIGN_OFFICE',name:'Kurumsal makamdan istifa et',
    owner:'StoryCharacterActions.storyCharacterActionExecutePlayer',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const office=(ctx.heldInstitutions||[]).find(row=>row.id===String(input&&input.institutionId||''))
            ||(ctx.heldInstitutions||[])[0];
        const candidate=office&&typeof storyCharacterActionCandidate==='function'?storyCharacterActionCandidate({
            actorId:ctx.actorId,targetActorId:null,actionType:'RESIGN',decisionSource:'PLAYER_UI',
            domainContext:{targetInstitutionId:office.id}
        }):null;
        const reasons=[];
        if(!office)reasons.push('Oyuncunun tuttugu kurumsal makam yok.');
        if(office&&(!candidate||!candidate.allowed))reasons.push(...(candidate&&candidate.reasons||['Gecerli halef yok.']));
        return {allowed:reasons.length===0,code:reasons.length?'RESIGN_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:office&&office.id||null,cost:{office:true},institutionId:office&&office.id||null};
    },
    execute(input,preview){
        const result=storyCharacterActionExecutePlayer('RESIGN',null,{targetInstitutionId:preview.institutionId});
        return result&&result.ok&&result.receipt&&result.receipt.domainReceipt&&result.receipt.domainReceipt.physicalMutation
            ?{ok:true,worldMutation:true,canonicalReceipt:Object.assign({ledger:'characterActions'},result.receipt.domainReceipt)}
            :{ok:false,code:result&&result.reason||'RESIGN_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'ELECTIONS',actionId:'CALL_EARLY_ELECTION',name:'Erken secim cagrisi yap',
    owner:'StoryElections.storyElectionCallEarly',
    preview(){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const executive=(ctx.heldInstitutions||[]).find(row=>row.type==='EXECUTIVE');
        const country=STORY.elections&&STORY.elections.countries[ctx.countryId];
        const open=country&&(country.electionIds||[]).map(id=>STORY.elections.elections[id]).find(row=>row&&!['CERTIFIED','CANCELLED'].includes(row.status));
        const reasons=[];
        if(!ctx.st||!executive)reasons.push('Yurutme makami gerekli.');
        if(!country||!country.competitive)reasons.push('Rekabetci secim rejimi gerekli.');
        if(open)reasons.push('Zaten acik bir secim var.');
        return {allowed:reasons.length===0,code:reasons.length?'ELECTION_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:executive&&executive.id||null,cost:{welfare:2},countryId:ctx.countryId};
    },
    execute(input,preview){
        const result=storyElectionCallEarly(preview.countryId,{actorId:preview.actorId});
        if(!result||!result.ok)return {ok:false,code:result&&result.code||'EARLY_ELECTION_FAILED'};
        const st=storyPlayerState();if(st)st.welfare=Math.max(0,(Number(st.welfare)||0)-2);
        return {ok:true,worldMutation:true,canonicalReceipt:{ledger:'elections',electionId:result.election.id,before:result.before,after:result.after}};
    }
});
storyPlayerAgencyRegister({
    familyId:'INVESTIGATIONS',actionId:'REGISTER_ALLEGATION',name:'Resmi inceleme dosyasi ac',
    owner:'StoryIntegrity.storyIntegrityCreateCase',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const actor=ctx.actorId&&typeof storyCharacterIdentityView==='function'?storyCharacterIdentityView(ctx.actorId):null;
        const sourceKey=String(input&&input.sourceKey||`player-allegation:${Math.floor(Number(STORY.clock)||0)}:${storyPlayerAgencyEnsure().sequence+1}`);
        const reasons=[];if(!ctx.st||!actor||actor.countryId!==ctx.countryId)reasons.push('Kanonik oyuncu karakteri gerekli.');
        return {allowed:reasons.length===0,code:reasons.length?'INVESTIGATION_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:'PUBLIC_INTEGRITY_CHANNEL',cost:{evidence:1},countryId:ctx.countryId,sourceKey};
    },
    execute(input,preview){
        const result=storyIntegrityCreateCase(storyIntegrityEnsure(),{countryId:preview.countryId,kind:'PUBLIC_ALLEGATION',
            sourceKey:preview.sourceKey,subjectActorId:input&&input.subjectActorId||null,redFlags:['PLAYER_FILED']});
        return result&&result.ok?{ok:true,worldMutation:true,canonicalReceipt:{ledger:'integrity',caseId:result.case.id,status:result.case.status}}
            :{ok:false,code:result&&result.reason||'ALLEGATION_FAILED'};
    }
});
storyPlayerAgencyRegister({
    familyId:'DIPLOMACY',actionId:'DIPLOMATIC_OUTREACH',name:'Diplomatik temas heyeti gonder',
    owner:'Talks.storyRelAdd',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const executive=(ctx.heldInstitutions||[]).find(row=>row.type==='EXECUTIVE');
        const targetStateId=Number.isInteger(Number(input&&input.targetStateId))?Number(input.targetStateId)
            :Number((STORY.states||[]).find(row=>ctx.st&&row.id!==ctx.st.id)&&((STORY.states||[]).find(row=>row.id!==ctx.st.id)).id);
        const reasons=[];if(!ctx.st||!executive)reasons.push('Yurutme makami gerekli.');
        if(!storyState(targetStateId)||targetStateId===Number(ctx.st&&ctx.st.id))reasons.push('Gecerli yabanci devlet gerekli.');
        if(ctx.st&&STORY.commander&&Number(STORY.commander.res&&STORY.commander.res.points)<15)reasons.push('15 butce puani gerekli.');
        return {allowed:reasons.length===0,code:reasons.length?'DIPLOMACY_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:executive&&executive.id||null,cost:{points:15},targetStateId,stateId:ctx.st&&ctx.st.id};
    },
    execute(input,preview){
        const paid=storyBudgetDebit(storyPlayerState(),15,'diplomacy.outreach',{commander:STORY.commander,commanderOnly:true});
        if(!paid.ok)return {ok:false,code:paid.code||'DIPLOMACY_BUDGET_FAILED'};
        const before=storyRelValue(preview.stateId,preview.targetStateId);
        const after=storyRelAdd(preview.stateId,preview.targetStateId,6,{actor:{type:'character',id:preview.actorId},reason:'player.outreach'});
        return {ok:true,worldMutation:true,canonicalReceipt:{ledger:'rel',targetStateId:preview.targetStateId,before,after,
            transactionId:paid.transaction&&paid.transaction.id||null}};
    }
});
storyPlayerAgencyRegister({
    familyId:'MEDIA',actionId:'PUBLIC_BRIEFING',name:'Kamuoyu bilgilendirme toplantisi yap',
    owner:'News.storyNews',
    preview(input){
        const ctx=typeof storyGovernancePlayerContext==='function'?storyGovernancePlayerContext():{};
        const executive=(ctx.heldInstitutions||[]).find(row=>row.type==='EXECUTIVE');
        const reasons=[];if(!ctx.st||!executive)reasons.push('Yurutme makami gerekli.');
        if(STORY.commander&&Number(STORY.commander.res&&STORY.commander.res.points)<20)reasons.push('20 butce puani gerekli.');
        return {allowed:reasons.length===0,code:reasons.length?'MEDIA_LOCKED':'READY',reasons,
            actorId:ctx.actorId||null,authoritySource:executive&&executive.id||null,cost:{points:20},
            topic:String(input&&input.topic||'Ekonomi ve kamu hizmetleri')};
    },
    execute(input,preview){
        const st=storyPlayerState();
        const paid=storyBudgetDebit(st,20,'media.public_briefing',{commander:STORY.commander,commanderOnly:true});
        if(!paid.ok)return {ok:false,code:paid.code||'MEDIA_BUDGET_FAILED'};
        storyNewsCredBackfill(st);const before=st.pressCred;st.pressCred=Math.min(100,before+1);
        const news=storyNews('demand',{st:st.name,dem:preview.topic,res:'kamuoyuna aciklandi'});
        return {ok:true,worldMutation:true,canonicalReceipt:{ledger:'news',newsId:news.id,pressCredBefore:before,
            pressCredAfter:st.pressCred,transactionId:paid.transaction&&paid.transaction.id||null}};
    }
});
storyPlayerAgencyRegister({
    familyId:'TECHNOLOGY',actionId:'SET_RESEARCH_PRIORITY',name:'AR-GE onceligi belirle',
    owner:'StoryUI.storyTechSetPriority',
    preview(input){
        const st=storyPlayerState();
        const available=typeof TECH_TREE!=='undefined'?(TECH_TREE.techs||[]).filter(t=>storyTechStatusFor(st&&st.tech||[],t).state==='available'):[];
        const tech=available.find(t=>t.id===String(input&&input.techId||''))||available[0];
        const reasons=[];if(!st)reasons.push('Oyuncu devleti bulunamadi.');if(!tech)reasons.push('Uygun arastirma yok.');
        const status=tech&&storyTechStatusFor(st.tech||[],tech);
        return {allowed:reasons.length===0,code:reasons.length?'TECH_LOCKED':'READY',reasons,
            actorId:STORY.commander&&`character:${STORY.playerStateId|0}:${STORY.commander.id}`||null,
            authoritySource:'STATE_RESEARCH_AGENDA',cost:{techPoints:status&&status.cost||0},techId:tech&&tech.id||null};
    },
    execute(input,preview){
        const result=storyTechSetPriority(preview.techId,{actorId:preview.actorId});
        return result&&result.ok?{ok:true,worldMutation:true,canonicalReceipt:result.receipt}:{ok:false,code:result&&result.code||'TECH_PRIORITY_FAILED'};
    }
});
