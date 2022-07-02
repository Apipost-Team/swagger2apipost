import Swagger2Apipost from '../src/index';
let fs = require('fs');
let path = require('path');

describe('works',() => {
  const json2_2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/swagger2Info_2.json'), 'utf-8'));
  const json3_4 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/swagger3Info_4.json'), 'utf-8'));
  const json2_4 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/swagger2Info_4.json'), 'utf-8'));
  const json3_5 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/swagger3Info_5.json'), 'utf-8'));
  const json3_6 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/swagger3Info_6.json'), 'utf-8'));
  const json3_7 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/swagger3Info_7.json'), 'utf-8'));
  const json3_8 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/swagger3Info_8.json'), 'utf-8'));

  const converter = new Swagger2Apipost();
  // it('测试Swagger2Apipost 2.0 success', async () => {
  //   expect((await converter.convert(json2_2,{
  //     basePath:false
  //   })).status).toBe('success');
  // });
  // it('测试Swagger2Apipost 2.0 success', async () => {
  //   expect((await converter.convert(json2_4,{
  //     basePath:false
  //   })).status).toBe('success');
  // });
  // it('测试Swagger2Apipost 3.0 success', async () => {
  //   expect((await converter.convert("https://test-demo-api.apipost.cn/api/swagger/info9")).status).toBe('success');
  // });
  // it('测试Swagger2Apipost 3.0 success',async () => {
  //   expect((await converter.convert(json3_5)).status).toBe('success');
  // });
  // it('测试Swagger2Apipost 3.0 success',async () => {
  //   expect((await converter.convert(json3_6)).status).toBe('success');
  // });
  // it('测试Swagger2Apipost 3.0 success', async () => {
  //   expect((await converter.convert(json3_7)).status).toBe('success');
  // });
  it('测试Swagger2Apipost 3.0 success', async () => {
    expect((await converter.convert(json3_7)).status).toBe('success');
  });
});

