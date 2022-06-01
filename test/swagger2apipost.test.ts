import Swagger2Apipost from '../src/index';
let fs = require('fs');
let path = require('path');

describe('works', () => {
  // const json1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/swagger2Info_1.json'), 'utf-8'));
  const json4 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/swagger2Info_4.json'), 'utf-8'));
  const converter = new Swagger2Apipost();
  it('测试Swagger2Apipost 2.0 success', () => {
    expect(converter.convert(json4).status).toBe('success');
  });
});

