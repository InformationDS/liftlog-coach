import { describe, expect, it } from 'vitest';
import { postCheck } from '../core/intents/advice/postCheck';
describe('CP6 limited Where you are postCheck',()=>{
 const data={sessions:[{date:'Tue 22 Sep',top_set:'100 kg × 5'},{date:'Mon 19 Oct',top_set:'140 lb × 10'}]};
 it.each(['100 kg','140 lb','Tue 22 Sep','22 Sep','Mon 19 Oct','19 Oct'])('existing %s is unflagged',value=>expect(postCheck(`**Where you are**\n${value}\n**What to try**\n105 kg`,data)).toEqual([]));
 it.each(['105 kg','97.5 kg','100kg','99lb','Wed 23 Sep','23 Sep'])('missing exact substring %s flagged',value=>expect(postCheck(`**Where you are**\n${value}\n**What it suggests**`,data)).toEqual([`not in data: "${value}"`]));
 it('only prescribed section; no extra numeric, safety, pairing claims',()=>{expect(postCheck('105 kg\n**Where you are**\n100 kg on Mon 19 Oct; 900 sets\n**What it suggests**\n999 kg, 30 Sep\n**What to try**\n101 kg',data)).toEqual([]);});
 it('no heading means no flags, even when text contains weights',()=>expect(postCheck('105 kg on Wed 23 Sep',data)).toEqual([]));
 it('multiple missing values retain ordered flags',()=>expect(postCheck('**Where you are**\n105 kg on Fri 23 Oct and 9 lb.',data)).toEqual(['not in data: "105 kg"','not in data: "Fri 23 Oct"','not in data: "9 lb"']));
});
