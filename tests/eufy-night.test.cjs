const {test}=require('node:test');const assert=require('node:assert/strict');const {classify}=require('../eufy-night.js');
function pixels(colours){return Uint8ClampedArray.from(colours.flatMap(c=>[...c,255]));}
test('dark infrared pixels enable night view',()=>assert.equal(classify(pixels(Array(100).fill([7,7,7]))),true));
test('bright greyscale day stays original',()=>assert.equal(classify(pixels(Array(100).fill([140,140,140]))),false));
test('dark colourful daytime scene stays original',()=>assert.equal(classify(pixels(Array(100).fill([12,30,55]))),false));
test('bright highlights alone do not suppress night detection',()=>assert.equal(classify(pixels([...Array(80).fill([7,7,7]),...Array(20).fill([220,220,220])])),true));
test('empty input never activates',()=>assert.equal(classify(new Uint8ClampedArray()),false));
