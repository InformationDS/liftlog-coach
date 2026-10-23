import {createHash} from 'node:crypto';
import {expect, it} from 'vitest';
import {buildTestConnection, promptSets} from '../core/prompts/builder';
import type {AdviceData} from '../core/intents/advice/dataPrep';
import {NOW, slots} from './cp4Fixtures';

const hash = (request: {messages: unknown; temperature?: number; maxTokens?: number; expectJson: boolean}) => createHash('sha256').update(JSON.stringify({messages:request.messages,temperature:request.temperature,maxTokens:request.maxTokens,expectJson:request.expectJson})).digest('hex');
const adviceData = (mode: AdviceData['mode']): AdviceData => ({mode,dataJson:mode==='data'?{sessions:[{date:'Mon 19 Oct',top_set:'60 kg × 8'}]}:null,label:'fixture',targetLabel:'bench',sessionCount:mode==='data'?3:0});
const requests = {
  p1: promptSets.v1.classify('Bench 60kg 3x8',null,NOW),
  p1_pending: promptSets.v1.classify('3x8',slots(),NOW),
  ...Object.fromEntries((['data','insufficient','general'] as const).flatMap(mode=>[false,true].map(discomfort=>[
    `p4_${mode}_${discomfort}`,promptSets.v1.advice(adviceData(mode),'general_knowledge','Question with """quotes',discomfort),
  ]))),
  p3: promptSets.v1.trendInterpretation({exercise:'bench',range:'week',mixed_units:false,sessions:[],summary:{session_count:0,first_top_weight_kg:0,last_top_weight_kg:0,best_top_set:'',best_top_weight_kg:0,best_date:'',change_kg:0,change_percent:null,sessions_since_last_increase:0}}),
  p6: buildTestConnection(),
};
it('locks v1 P1/P3/P4/P6 wire requests before round2 edits',()=>{
  expect(Object.fromEntries(Object.entries(requests).map(([key,value])=>[key,hash(value)]))).toEqual({
    p1:'52b832c89c2402c8c491e0ac5d973d04a2845ba83b7655b93db80e319b87f5c8',
    p1_pending:'c38c2efef53ef8968c836b38e4b8c9433df1e4e66cc577f07d279b39753deac4',
    p4_data_false:'ddeb443429da35d8b470615a3f0e69114278f4c3e2331eff5fb9b4b072552c59',
    p4_data_true:'1b51e4f8e3ea432268832cbfdfc70aef94b2e5fcbf24716e20794dfca9057364',
    p4_insufficient_false:'11e259c8226dd753bc9c0dc24521f6b9b5dffb0b2e85ed6ce443dce478d0887b',
    p4_insufficient_true:'7fac5b17d034b61caff3ad10dd27f6f47533742990e7c71079183133ff210d57',
    p4_general_false:'33c2baad167d0d88ef24ffe695b5141583dabf8cd2518b7f6003687f36cfebb6',
    p4_general_true:'e16ba070a5ffdc7ed6b15afabf46923f96dbdc8501c081fb685b1f1647b69640',
    p3:'3d4546529a921f1b3c55c2689bd272b8890651fc0f30e4993e4f0ef8a589f1de',
    p6:'a32391c10892019874f94cf866bb24576a256b30ff89642a0acfe9e6a2a04734',
  });
  expect(promptSets.v1.riskCheck).toBeNull();
});
