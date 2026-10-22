import { expect, it } from 'vitest';
import { extractJson, parseJson, parseJsonWithSchema } from '../core/llm/jsonRepair';
import { classificationSchema } from '../core/llm/schemas';
it.each(['```json\n{"x":1}\n```', 'Here is the result: {"x":1} thank you', '{"x":1,}', "{'x':1}", '{"x":1', '{"x":1,'])('parses/repairs %s', text => expect(parseJson(text)).toMatchObject({ok: true, data: {x: 1}}));
it('repairs nested arrays, trailing commas and escaped single-quoted strings', () => {
  expect(parseJson("{'x': [1,2,], 's': 'don\\'t', 'q': 'say \"hi\"',}")).toMatchObject({ok: true, data: {x: [1, 2], s: "don't", q: 'say "hi"'}});
  expect(parseJson('{"x":[1,2')).toMatchObject({ok: true, data: {x: [1, 2]}});
});
it('preserves punctuation inside double-quoted strings', () => {
  const data = {text: "a,} b,] 'quote' ```json", nested: {value: 'ok'}};
  expect(parseJson(JSON.stringify(data))).toEqual({ok: true, data, repaired: false});
  expect(parseJson(JSON.stringify(data).replace(/}$/, ',}'))).toMatchObject({ok: true, data, repaired: true});
});
it.each(['nonsense', '{x: nope}', '{"x":"unfinished', '{"x": [1}', '{"x":undefined}', '{"x":1} {"y":2}'])('clearly fails %s', text => expect(parseJson(text)).toEqual({ok: false, error: 'invalid_json'}));
it('extracts exactly outer object and distinguishes schema failure', () => {
  expect(extractJson('```json\n{"x":1}\n```')).toBe('{"x":1}');
  expect(parseJsonWithSchema('{"intent":"unknown", "confidence":1}', classificationSchema)).toEqual({ok: false, error: 'invalid_schema'});
  expect(parseJsonWithSchema('{bad}', classificationSchema)).toEqual({ok: false, error: 'invalid_json'});
  expect(parseJsonWithSchema('{"intent":"unknown","confidence":"0.65","slots":{"category":"vague"},}', classificationSchema)).toMatchObject({ok: true, repaired: true, data: {confidence: 0.65}});
});
