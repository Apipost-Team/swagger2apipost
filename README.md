swagger2apipost 是一个swagger JSON 到 ApiPost 导入项目数据 的转换器。

# 🎉 特性

- 支持格式 
- swagger2.0 支持swagger(openapi) 3.0  还支持传入swagger url
# 安装

```shell
npm i swagger2apipost
```

# 基础使用
需引入：

```js
import Swagger2Apipost from 'swagger2apipost';
const converter = new Swagger2Apipost();
const convertResult= await converter.convert(swaggerJson 或者 swaggerUrl,options);
```
**检查结果:**

```js
convertResult.status === "error"
```
**对于不成功的转换。检查 convertResult.message**

```js
convertResult.status === "success"
```
**成功转换,结果在convertResult.data中**

## Options type:Object

| *参数* | *类型* | *默认值* | *参数描述* |
| --- | --- | :---: | :---: |
| basePath | Boolean | true | 接口路径是否添加basePath |
| host | Boolean | true | 接口路径是否添加host |

# 开源协议

swagger2apipost 遵循 [MIT 协议](https://github.com/Apipost-Team/swagger2apipost)。
