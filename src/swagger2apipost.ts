import _url from 'url';
import SwaggerClient from 'swagger-client';
import axios from 'axios'
import parseUrl from 'url-parse';

import { ConvertResult, getApipostMode, handleBodyJsonSchema } from './utils';
const MockSchema = require('apipost-mock-schema');
// import MockSchema from 'apipost-mock-schema';
import { isArray, isEmpty, isPlainObject, isString } from 'lodash';
import { v4 as uuidV4 } from 'uuid';
function replaceRef(schemaObj: any) {
  try {
    for (const key in schemaObj) {
      const value = schemaObj[key];
      // 如果当前属性的值是一个对象，则递归遍历该对象
      if (typeof value === 'object' && value !== null) {
        // 查找并替换 insAppInfo 对象
        if (value.hasOwnProperty('ref') || value.hasOwnProperty('$$ref')) {
          let newIuid = uuidV4();
          schemaObj[key] = {
            APIPOST_REFS: {
              [newIuid]: {
                ref: value?.ref || value?.['$$ref']
              },
            },
            properties: {},
            APIPOST_ORDERS: [newIuid],
            type: "object",
            ref: value?.ref || value?.['$$ref']
          }
          break;
        }
        replaceRef(value);
      }
    }
  } catch (error) { }
}
function prependHttp(url: any, { https = true } = {}) {
  if (typeof url !== 'string') {
    throw new TypeError(`Expected \`url\` to be of type \`string\`, got \`${typeof url}\``);
  }

  url = url.trim();

  if (/^\.*\/|^(?!localhost)\w+?:/.test(url)) {
    return url;
  }

  return url.replace(/^(?!(?:\w+?:)?\/\/)/, https ? 'https://' : 'http://');
}

function urlParseLax(url: string, options?: any) {
  if (typeof url !== 'string') {
    return '';
  }
  const finalUrl = prependHttp(url, options);
  return parseUrl(finalUrl);
};
const swaggerSchema2apipostSchema = (schemaObj: any) => {
  let jsonSchema: any = {};
  try {
    // x-apifox-orders 2 APIPOST_ORDERS x-apifox-refs 2 APIPOST_REFS  $ref 2 ref  x-apifox-overrides 2 APIPOST_OVERRIDES
    let jsonSchemaStr = JSON.stringify(schemaObj);
    // 替换 x-apifox-orders 为 APIPOST_ORDERS
    jsonSchemaStr = jsonSchemaStr.replace(/\"x-apifox-orders\"/g, '\"APIPOST_ORDERS\"');
    // 替换 x-apifox-refs 为 APIPOST_REFS
    jsonSchemaStr = jsonSchemaStr.replace(/\"x-apifox-refs\"/g, '\"APIPOST_REFS\"');
    // 替换 $ref 为 ref
    jsonSchemaStr = jsonSchemaStr.replace(/\"\$ref\"/g, '\"ref\"');
    // 替换 $ref 为 ref
    jsonSchemaStr = jsonSchemaStr.replace(/\"\$\$ref\"/g, '\"ref\"');
    // 替换 x-apifox-overrides 为 APIPOST_OVERRIDES
    jsonSchemaStr = jsonSchemaStr.replace(/\"x-apifox-overrides\"/g, '\"APIPOST_OVERRIDES\"');
    // 还原为对象
    jsonSchema = JSON.parse(jsonSchemaStr);
    if (jsonSchema.hasOwnProperty('ref') || jsonSchema.hasOwnProperty('$$ref')) {
      let newIuid = uuidV4();
      if (isString(jsonSchema?.ref) && jsonSchema.ref.split('#').length == 2) {
        jsonSchema.ref = `#${jsonSchema.ref.split('#')[1]}`;
      }
      jsonSchema = {
        APIPOST_REFS: {
          [newIuid]: {
            ref: jsonSchema?.ref || jsonSchema?.['$$ref']
          },
        },
        properties: {},
        APIPOST_ORDERS: [newIuid],
        type: "object",
      }
    } else {
      replaceRef(jsonSchema)
    }
  } catch (error) { }

  return jsonSchema;
}

class Swagger2Apipost {
  version: string;
  project: any;
  basePath: string;
  apis: any[];
  folders: any;
  folderNames: any;
  baseParams: any;
  globalConsumes: any;
  globalProduces: any;
  env: any[];
  options: any;
  dataModel: any[];
  constructor() {
    this.version = '2.0';
    this.project = {};
    this.basePath = '';
    this.apis = [];
    this.folders = {};
    this.folderNames = {};
    this.baseParams = {};
    this.env = [];
    this.options = {
      basePath: true,
      host: true
    }
    this.dataModel = [];
  }
  validate(json: any) {
    if (json.hasOwnProperty('swagger')) {
      if (json.swagger !== '2.0') {
        return ConvertResult('error', 'Must contain a swagger field 2.0');
      } else {
        this.version = '2.0';
      }
    }
    if (json.hasOwnProperty('openapi')) {
      this.version = '3.0';
    }
    if (!json.hasOwnProperty('swagger') && !json.hasOwnProperty('openapi')) {
      return ConvertResult('error', 'Must contain a swagger field 2.0 or 3.0');
    }

    return ConvertResult('success', '');
  }
  setBasePath(json: any) {
    this.basePath = '';
    if (json.host && this.options.host) {
      this.basePath = json.host;
    }


    if (json.basePath && this.options.basePath) {
      this.basePath += json.basePath;
    }

    // if (json.schemes && json.schemes.indexOf('https') != -1) {
    //   this.basePath = 'https://' + this.basePath;
    // }
    // else {
    //   this.basePath = 'http://' + this.basePath;
    // }

    if (!isEmpty(this.basePath) && !this.endsWith(this.basePath, '/')) {
      this.basePath += '/';
    }
  }
  handleInfo(json: any) {
    this.project.name = json?.info?.title || '新建项目';
    this.project.description = json?.info?.description || '';
  }
  handleServers(json: any) {
    if (!json.hasOwnProperty('servers')) {
      return;
    }
    var servers = json.servers;
    for (const server of servers) {

      let newEnv: any = {
        name: server?.description || server?.url || '未命名环境',
        pre_url: server.url || '',
        type: 'custom',
        list: {},
      }
      if (server.hasOwnProperty('variables')) {
        for (const key in server.variables) {
          newEnv.list[key] = {
            current_value: server.variables[key].default || '',
            value: server.variables[key].default || '',
            description: server.variables[key].description || '', // 参数描述
          };
        }
      }
      this.env.push(newEnv);
    }
  }
  handleTags(tags: any[], tagsInfo: any) {
    for (let i = 0; i < tags.length; i++) {
      let tagString = tags[i];
      let tagArray = tagString.split('/');
      for (let index = 1; index < tagArray.length + 1; index++) {
        const tag = tagArray[index - 1];
        const folderPath = tagArray.slice(0, index).join('/');
        const grandpaFolderPath = tagArray.slice(0, index - 1).join('/');
        if (!this.folders.hasOwnProperty(folderPath)) {
          this.folders[folderPath] = this.createNewFolder(tag, tagsInfo);
          if (index == 1) {
            this.apis.push({
              ...this.folders[folderPath],
              sort: i + 1,
            });
          } else {
            this.folders[grandpaFolderPath].children.push({
              ...this.folders[folderPath],
              sort: this.folders[grandpaFolderPath].children.length + 1,
            });
          }
        }
      }
    }
  }
  async handlePathV3(path: string, pathItem: any, tags: any) {
    let url = path;
    // if(this.options.basePath){
    //   url=decodeURI(_url.resolve(this.basePath, path))
    // }
    if (path && path.charAt(0) == '/') {
      url = path.substring(1);
    }
    for (const method in pathItem) {
      let swaggerApi = pathItem[method];
      if (swaggerApi.hasOwnProperty('tags') && swaggerApi.tags.length > 0) {
        this.handleTags(swaggerApi.tags, tags);
      }
      let api: any = {
        'name': swaggerApi?.summary || '新建接口',
        'target_type': 'api',
        'tags': swaggerApi?.apipost_tags || [],
        'url': url || '',
        'mock_url': urlParseLax(url)?.pathname || '',
        'method': method.toUpperCase() || 'GET',
        'request': {
          'description': swaggerApi?.description || '',
        },
        'response': {
          'success': {
            parameter: [],
            raw: '',
            expect: {
              name: '成功',
              isDefault: 1,
              code: '200',
              contentType: "json",
              schema: {},
              mock: "",
              verifyType: "schema",
            },
          },
          'error': {
            parameter: [],
            raw: ''
          }
        }
      }
      const { request } = api;
      const { response } = api;
      if (swaggerApi.hasOwnProperty('parameters')) {
        for (const parameter of swaggerApi.parameters) {
          if (parameter.hasOwnProperty('in')) {
            if (parameter.in == 'query') {
              if (!request.hasOwnProperty('query')) {
                request['query'] = [];
              }
              parameter?.name && request.query.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.schema?.example || parameter?.default || '', //参数值
                not_null: parameter?.required ? "1" : "-1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: parameter?.type || "Text" // 类型
              })
            } else if (parameter.in == 'header') {
              if (!request.hasOwnProperty('header')) {
                request['header'] = [];
              }
              parameter?.name && request.header.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.schema?.example || parameter?.default || '', //参数值
                not_null: parameter.required ? "1" : "-1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: parameter?.type || "Text" // 类型
              })
            } else if (parameter.in == 'path') {
              if (!request.hasOwnProperty('resful')) {
                request['resful'] = [];
              }
              parameter?.name && request.resful.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.schema?.example || parameter?.default || '', //参数值
                not_null: parameter.required ? "1" : "-1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: parameter?.type || "Text" // 类型
              })
            }
          }
        }
      }

      if (swaggerApi.hasOwnProperty('requestBody') && swaggerApi.requestBody.hasOwnProperty('content')) {
        let content = swaggerApi.requestBody.content;
        let mode = content instanceof Object ? Object.keys(content)[0] : "none";
        let bodyData = content[mode];
        let apipostMode = getApipostMode(mode)
        let properties: any = {};
        if (bodyData.hasOwnProperty('schema')) {
          let { schema } = bodyData;
          if (schema?.type === 'array') {
            properties = schema?.items?.properties;
          } else {
            properties = schema?.properties;
          }
        }
        request.body = {
          "mode": apipostMode,
          "parameter": [],
          "raw": "",
          "raw_para": []
        };

        if (apipostMode == 'urlencoded' || apipostMode == 'form-data') {
          for (const key in properties) {
            let item = properties[key];

            key && request.body.parameter.push(
              {
                is_checked: "1",
                type: item.hasOwnProperty('format') && item.format == 'binary' ? 'File' : 'Text',
                key: key || "",
                value: item?.example || "",
                not_null: item?.required ? "1" : "-1",
                description: item?.description || "",
                field_type: item.hasOwnProperty('type') ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : "Text"
              })
          }
        }
        else if (apipostMode == 'json') {

          if (bodyData.hasOwnProperty('example')) {
            let example = bodyData.example;
            if (typeof example == 'object') {
              example = JSON.stringify(example);
            }
            request.body.raw = example;
          }

          if (bodyData.hasOwnProperty('schema')) {
            request.body.raw_schema = swaggerSchema2apipostSchema(bodyData.schema);
            let raw_para: any = [];
            let Raw = handleBodyJsonSchema(bodyData.schema, raw_para)
            let Raw_text = isPlainObject(Raw) || Array.isArray(Raw) ? JSON.stringify(Raw) : Raw;
            request.body.raw = request.body.raw ? request.body.raw : Raw_text;
            request.body.raw_para = raw_para;
            if (isEmpty(request.body.raw)) {
              try {
                const myMockSchema = new MockSchema();
                let schemaJson = await myMockSchema.mock(bodyData.schema)

                request.body.raw = isPlainObject(schemaJson) || Array.isArray(Raw) ? JSON.stringify(schemaJson) : schemaJson;
              } catch (error) { }
            }
            if (typeof request.body.raw == 'object') {
              request.body.raw = `${request.body.raw}`
            }
          }
        }
      }
      if (swaggerApi.hasOwnProperty('responses')) {
        if (Object.prototype.toString.call(swaggerApi.responses) === '[object Object]') {
          Object.keys(swaggerApi.responses).forEach((status: any) => {
            const element = swaggerApi.responses[status];
            if ((element.hasOwnProperty('schema') && element.schema.hasOwnProperty('properties') && JSON.stringify(element.schema.properties) !== "{}") || element?.schema?.type === 'array') {
              let raw_para: any = [];
              let Raw = handleBodyJsonSchema(element.schema, raw_para)
              let Raw_text = isPlainObject(Raw) || Array.isArray(Raw) ? JSON.stringify(Raw) : Raw;

              let jsonSchema = {};

              if (Object.prototype.toString.call(element?.schema?.['$$ref']) === "[object String]") {
                jsonSchema = swaggerSchema2apipostSchema(element.schema);
              } else {
                jsonSchema = element.schema
              }
              // 成功响应示例
              if (status == 200) {
                response.success.raw = Raw_text;
                response.success.parameter = raw_para;
                response.success.expect.schema = jsonSchema;
              } else {
                // 其他示例
                let newUUID = uuidV4();
                response[newUUID] = {
                  expect: {
                    name: element?.description || status,
                    isDefault: -1,
                    code: status,
                    contentType: "json",
                    schema: jsonSchema,
                    mock: "",
                    verifyType: "schema",
                  },
                  raw: Raw_text,
                  parameter: raw_para,
                }
              }
            } else if (element.hasOwnProperty('content') && Object.keys(element.content)?.length > 0) {
              let content = element.content;


              let mode = content instanceof Object ? Object.keys(content)[0] : "none";
              let bodyData = content[mode];

              let apipostMode = getApipostMode(mode)
              let properties: any = {};
              if (bodyData.hasOwnProperty('schema')) {
                let { schema } = bodyData;
                if (schema.hasOwnProperty('properties')) {
                  properties = schema.properties;
                }
                if (schema.hasOwnProperty('items')) {
                  properties = schema?.items?.properties;
                }
              }
              if (apipostMode == 'json') {
                let jsonSchema = {};

                if (Object.prototype.toString.call(bodyData?.schema?.['$$ref']) === "[object String]") {
                  jsonSchema = swaggerSchema2apipostSchema(bodyData.schema);
                } else if (isPlainObject(bodyData?.schema)) {
                  jsonSchema = bodyData.schema
                }
                if (bodyData.hasOwnProperty('example')) {
                  let example = bodyData.example;
                  if (typeof example == 'object') {
                    if (status == 200) {
                      try {
                        response.success.raw = JSON.stringify({ ...example });
                      } catch (error) {
                        response.success.raw = String({ ...example });
                      }
                      response.success.parameter = [];
                      response.success.expect.schema = jsonSchema;
                    } else {
                      // 其他示例
                      let newUUID = uuidV4();
                      response[newUUID] = {
                        expect: {
                          name: element?.description || status,
                          isDefault: -1,
                          code: status,
                          contentType: "json",
                          schema: jsonSchema,
                          mock: "",
                          verifyType: "schema",
                        },
                        raw: '',
                        parameter: [],
                      }
                      try {
                        response[newUUID].raw = JSON.stringify({ ...example });
                      } catch (error) {
                        response[newUUID].raw = String({ ...example });
                      }
                    }
                  }
                } else {

                  if (bodyData.hasOwnProperty('schema')) {
                    let raw_para: any = [];
                    let Raw = handleBodyJsonSchema(bodyData.schema, raw_para)
                    let Raw_text = isPlainObject(Raw) || Array.isArray(Raw) ? JSON.stringify(Raw) : Raw;

                    if (status == 200) {
                      response.success.raw = Raw_text;
                      response.success.parameter = raw_para;
                      response.success.expect.schema = jsonSchema;
                    } else {
                      // 其他示例
                      let newUUID = uuidV4();
                      response[newUUID] = {
                        expect: {
                          name: element?.description || status,
                          isDefault: -1,
                          code: status,
                          contentType: "json",
                          schema: jsonSchema,
                          mock: "",
                          verifyType: "schema",
                        },
                        raw: Raw_text,
                        parameter: raw_para,
                      }
                    }
                  }
                }
              }
            } else {
              // 其他示例
              let newUUID = uuidV4();
              response[newUUID] = {
                expect: {
                  name: element?.description || status,
                  isDefault: -1,
                  code: status,
                  contentType: "json",
                  schema: '',
                  mock: "",
                  verifyType: "schema",
                },
                raw: '',
                parameter: [],
              }
            }
          })
        }
      }
      if (swaggerApi.hasOwnProperty('tags') && swaggerApi.tags.length > 0) {
        for (const folder of swaggerApi.tags) {
          if (this.folders.hasOwnProperty(folder)) {
            this.folders[folder].children.push(api);
          }
        }
      } else {
        this.apis.push(api)
      }
    }
  }
  async handlePath(path: string, pathItem: any, tags: any) {
    let url = path;
    if (url.charAt(0) == '/') {
      url = url.substring(1);
    }
    if (url.charAt(url.length - 1) == '/') {
      url = url.substring(0, url.length - 1);
    }
    url = decodeURI(this.basePath + url)

    for (const method in pathItem) {
      let swaggerApi = pathItem[method];
      if (swaggerApi.hasOwnProperty('tags') && swaggerApi.tags.length > 0) {
        this.handleTags(swaggerApi.tags, tags);
      }
      let api: any = {
        'name': swaggerApi?.summary || '新建接口',
        'tags': swaggerApi?.apipost_tags || [],
        'target_type': 'api',
        'url': url || '',
        'mock_url': urlParseLax(url)?.pathname || '',
        'method': method.toUpperCase() || 'GET',
        'request': {
          'description': swaggerApi?.description || '',
        },
        'response': {
          'success': {
            'parameter': [],
            'raw': '',
            expect: {
              name: '成功',
              isDefault: 1,
              code: "200",
              contentType: "json",
              schema: {},
              mock: "",
              verifyType: "schema",
            },
          },
          'error': {
            'parameter': [],
            'raw': '',
            expect: {
              name: '失败',
              isDefault: -1,
              code: "404",
              contentType: "json",
              schema: {},
              mock: "",
              verifyType: "schema",
            },
          }
        }
      },
        thisProduces,
        thisConsumes;
      if (swaggerApi.produces) {
        thisProduces = swaggerApi.produces;
      }

      if (swaggerApi.consumes) {
        thisConsumes = swaggerApi.consumes;
      }
      const { request } = api;
      const { response } = api;

      if (thisProduces && thisProduces.length > 0) {
        if (!request.hasOwnProperty('header')) {
          request.header = []
        }
        request.header.push({
          is_checked: "1",
          type: 'Text',
          key: "Accept",
          value: thisProduces.join(', ') || "",
          not_null: "1",
          description: "",
          field_type: "string"
        });
      }
      if (thisConsumes && thisConsumes.length > 0) {
        if (!request.hasOwnProperty('header')) {
          request.header = []
        }
        request.header.push({
          is_checked: "1",
          type: 'Text',
          key: "Content-Type",
          value: thisConsumes[0] || "",
          not_null: "1",
          description: "",
          field_type: "string"
        });
      }

      if (swaggerApi.hasOwnProperty('parameters')) {
        let mode = 'none'
        if (thisConsumes && thisConsumes.length > 0) {
          mode = thisConsumes[0]
        }
        let apipostMode = getApipostMode(mode);

        request.body = {
          "mode": apipostMode,
          "parameter": [],
          "raw": {},
          "raw_para": []
        };
        for (const parameter of swaggerApi.parameters) {
          if (parameter.hasOwnProperty('in')) {
            if (parameter.in == 'query') {
              if (!request.hasOwnProperty('query')) {
                request['query'] = [];
              }
              parameter?.name && request.query.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.schema?.example || parameter?.default || '', //参数值
                not_null: parameter.required ? "1" : "-1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: parameter?.type || "Text" // 类型
              })
            } else if (parameter.in == 'header') {
              if (!request.hasOwnProperty('header')) {
                request['header'] = [];
              }

              parameter?.name && request.header.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.schema?.example || parameter?.default || '', //参数值
                not_null: parameter.required ? "1" : "-1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: parameter?.type || "Text" // 类型
              })
            } else if (parameter.in == 'path') {
              if (!request.hasOwnProperty('resful')) {
                request['resful'] = [];
              }
              parameter?.name && request.resful.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.schema?.example || parameter?.default || '', //参数值
                not_null: parameter.required ? "1" : "-1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: parameter?.type || "Text" // 类型
              })
            } else if (parameter.in == 'body') {
              if ((parameter.hasOwnProperty('schema') && JSON.stringify(parameter.schema.properties) !== "{}") || parameter?.type === 'array') {

                let raw_para: any = [];
                let Raw = handleBodyJsonSchema(parameter.schema, raw_para)
                let Raw_text = isPlainObject(Raw) || Array.isArray(Raw) ? JSON.stringify(Raw) : Raw;

                request.body.raw = parameter?.example || Raw_text;

                if (isEmpty(request.body.raw)) {
                  try {
                    const myMockSchema = new MockSchema();
                    let schemaJson = await myMockSchema.mock(parameter.schema)
                    request.body.raw = isPlainObject(schemaJson) || Array.isArray(Raw) ? JSON.stringify(schemaJson) : schemaJson;
                  } catch (error) { }
                }
                request.body.raw_para = raw_para;
              }

              if (Object.prototype.toString.call(parameter?.schema?.['$$ref']) === "[object String]") {
                request.body.raw_schema = swaggerSchema2apipostSchema(parameter.schema);
              } else {
                request.body.raw_schema = parameter.schema;
              }
            } else if (parameter.in == 'formData') {
              parameter.name && request.body.parameter.push({
                is_checked: "1", // 是否选择
                type: parameter.hasOwnProperty('type') && parameter.type == 'file' ? 'File' : "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.schema?.example || parameter?.default || '', //参数值
                not_null: parameter.required ? "1" : "-1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: parameter?.type || "Text" // 类型
              })
            }
          }
        }
        request.body.raw = isEmpty(request.body.raw) ? '' : JSON.stringify(request.body.raw);
      }
      if (swaggerApi.hasOwnProperty('responses')) {
        if (Object.prototype.toString.call(swaggerApi.responses) === '[object Object]') {
          Object.keys(swaggerApi.responses).forEach((status: any) => {
            const element = swaggerApi.responses[status];


            if ((element.hasOwnProperty('schema') && JSON.stringify(element.schema.properties) !== "{}") || element?.schema?.type === 'array') {
              let raw_para: any = [];
              let Raw = handleBodyJsonSchema(element.schema, raw_para)
              let Raw_text = isPlainObject(Raw) || Array.isArray(Raw) ? JSON.stringify(Raw) : Raw;
              let jsonSchema = {};
              if (Object.prototype.toString.call(element?.schema?.['$$ref']) === "[object String]") {
                jsonSchema = swaggerSchema2apipostSchema(element.schema);
              } else {
                jsonSchema = element.schema;
              }
              // 成功响应示例
              if (status == 200) {
                response.success.raw = Raw_text;
                response.success.parameter = raw_para;
                response.success.expect.schema = jsonSchema;
              } else {
                // 其他示例
                let newUUID = uuidV4();
                response[newUUID] = {
                  expect: {
                    name: element?.description || status,
                    isDefault: -1,
                    code: status,
                    contentType: "json",
                    schema: jsonSchema,
                    mock: "",
                    verifyType: "schema",
                  },
                  raw: Raw_text,
                  parameter: raw_para,
                }
              }
            } else if (isPlainObject(element?.content)) {
              let content = element?.content;
              let mode = content instanceof Object ? Object.keys(content)[0] : "none";
              let bodyData = content[mode];

              let raw_para: any = [];
              let Raw = handleBodyJsonSchema(bodyData?.schema, raw_para)
              let Raw_text = isPlainObject(Raw) || Array.isArray(Raw) ? JSON.stringify(Raw) : Raw;
              let jsonSchema = {};
              if (Object.prototype.toString.call(bodyData?.schema?.['$$ref']) === "[object String]") {
                jsonSchema = swaggerSchema2apipostSchema(bodyData.schema);
              } else if (isPlainObject(bodyData?.schema)) {
                jsonSchema = bodyData.schema;
              }

              if (status == 200) {
                response.success.raw = Raw_text;
                response.success.parameter = raw_para;
                response.success.expect.schema = jsonSchema;
              } else {
                // 其他示例
                let newUUID = uuidV4();
                response[newUUID] = {
                  expect: {
                    name: element?.description || status,
                    isDefault: -1,
                    code: status,
                    contentType: "json",
                    schema: jsonSchema,
                    mock: "",
                    verifyType: "schema",
                  },
                  raw: Raw_text,
                  parameter: raw_para,
                }
              }

              if (bodyData.hasOwnProperty('example')) {
                let example = bodyData.example;
                if (typeof example == 'object') {
                  example = JSON.stringify(example);
                }
                request.body.raw = example;
              }
            } else {
              // 其他示例
              let newUUID = uuidV4();
              response[newUUID] = {
                expect: {
                  name: element?.description || status,
                  isDefault: -1,
                  code: status,
                  contentType: "json",
                  schema: '',
                  mock: "",
                  verifyType: "schema",
                },
                raw: '',
                parameter: [],
              }
            }
          })
        }
      }
      if (swaggerApi.hasOwnProperty('tags') && swaggerApi.tags.length > 0) {
        for (const folder of swaggerApi.tags) {
          if (this.folders.hasOwnProperty(folder)) {
            if (Object.prototype.toString.call(this.folders[folder].children) === '[object Array]') {
              this.folders[folder].children.push({
                ...api,
                sort: this.folders[folder].children.length + 1,
              });
            }

          }
        }
      } else {
        this.apis.push(api)
      }
    }
  }
  async handlePathsV3(json: any) {
    var paths = json?.openapi?.paths || json.paths;
    var tags = json?.openapi?.tags || json.tags;
    for (const path in paths) {
      await this.handlePathV3(path, paths[path], tags);
    }
  }
  async handlePaths(json: any) {
    var paths = json.paths;
    var tags = json.tags;
    for (const path in paths) {
      await this.handlePath(path, paths[path], tags);
    }
  }
  getParamsForPathItem(oldParams: any, newParams: any) {
    var retVal: any = {},
      numOldParams,
      numNewParams,
      i,
      parts,
      lastPart,
      getBaseParam;

    oldParams = oldParams || [];
    newParams = newParams || [];

    numOldParams = oldParams.length;
    numNewParams = newParams.length;

    for (i = 0; i < numOldParams; i++) {
      if (oldParams[i].$ref) {
        if (oldParams[i].$ref.indexOf('#/parameters') === 0) {
          parts = oldParams[i].$ref.split('/');
          lastPart = parts[parts.length - 1];
          getBaseParam = this.baseParams[lastPart];
          retVal[lastPart] = getBaseParam;
        }
      }
      else {
        retVal[oldParams[i].name] = oldParams[i];
      }
    }

    for (i = 0; i < numNewParams; i++) {
      if (newParams[i].$ref) {
        if (newParams[i].$ref.indexOf('#/parameters') === 0) {
          parts = newParams[i].$ref.split('/');
          lastPart = parts[parts.length - 1];
          getBaseParam = this.baseParams[lastPart];
          retVal[lastPart] = getBaseParam;
        }
      }
      else {
        retVal[newParams[i].name] = newParams[i];
      }
    }

    return retVal;
  }
  createNewFolder(name: string, tags: any) {
    const description = tags?.find((tag: any) => tag.name === name)?.description || '';
    var newFolder = {
      'name': name,
      'target_type': 'folder',
      'description': description,
      'children': [],
    };
    this.folderNames[name] = true;
    return newFolder;
  }
  createDataModelNewFolder(folder_name: string) {
    var newFolder: any = {
      'model_id': '',
      'name': folder_name || '新建目录',
      'model_type': 'folder',
      'description': folder_name || '',
      'children': [],
    };
    return newFolder;
  }
  createNewModelData(item: any, key: any, folder_name: string) {
    var model: any = {
      model_id: `#/components/${folder_name}/${key}`,
      name: item?.title || key || '新建数据模型',
      displayName: item?.title || key || '',
      model_type: 'model',
      description: item?.description || '',
      schema: {},
    }
    try {
      model.schema = swaggerSchema2apipostSchema(item);
    } catch (error) { }
    return model;
  }
  handleModelApiAndFolder(folder_name: string, modals: any) {
    var root = this;
    if (Object.prototype.toString.call(modals) == '[object Object]') {
      const folder = root.createDataModelNewFolder(folder_name);
      root.dataModel.push(folder);
      Object.keys(modals).forEach(key => {
        let target = root.createNewModelData(modals[key], key, folder_name);
        folder.children.push(target)
      })
    }
  }
  createNewModelData2(item: any, model_name: string) {
    var model: any = {
      model_id: `#/definitions/${model_name}`,
      name: model_name || '新建数据模型',
      displayName: model_name || '',
      model_type: 'model',
      description: item?.description || '',
      schema: {},
    }
    try {
      model.schema = swaggerSchema2apipostSchema(item);
    } catch (error) { }
    return model;
  }
  handleModelApiAndFolder2(model_name: string, modals: any) {
    var root = this;
    if (Object.prototype.toString.call(modals) == '[object Object]') {
      let target = root.createNewModelData2(modals, model_name);
      root.dataModel.push(target)
    }
  }
  handleModelData(json: any) {
    if (json.hasOwnProperty('components') && Object.prototype.toString.call(json.components) == '[object Object]') {
      Object.keys(json.components).forEach((key) => {
        this.handleModelApiAndFolder(key, json.components[key]);
      });
    }
  }
  handleModelData2(json: any) {
    if (json.hasOwnProperty('definitions') && Object.prototype.toString.call(json.definitions) == '[object Object]') {
      Object.keys(json.definitions).forEach((key) => {
        this.handleModelApiAndFolder2(key, json.definitions[key]);
      });
    }
  }
  handleGlobalTags(json: any) {
    let that = this;

    if (isArray(json?.tags)) {
      json.tags.forEach((item: any) => {
        let folder_name = item?.name || '新建目录';
        if (!that.folderNames[folder_name] && !Object.keys(that.folders).includes(folder_name)) {
          that.apis.push({
            ...that.createNewFolder(folder_name, json.tags),
            sort: 1,
          });

        }
      })
    }
  }
  escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape the special characters
  }
  async convert(json: any, options: any = null) {
    try {
      if (options && options instanceof Object) {
        this.options = { ...this.options, ...options };
      }
      let swagger3Json = {};
      if (json instanceof Object) {
        await SwaggerClient.resolve({ spec: json }).then((swaggerJson: any) => {
          swagger3Json = swaggerJson.spec;
        })
      } else {
        const resp = await axios.get(json)
        if (isPlainObject(resp?.data)) {
          await SwaggerClient.resolve({ spec: resp.data }).then((swaggerJson: any) => {
            swagger3Json = swaggerJson.spec;
          })
        }
        try {
          let swagger3JsonStr = JSON.stringify(swagger3Json);

          let reg = new RegExp(`ref":"${this.escapeRegExp(json)}`, 'g')
          swagger3JsonStr = swagger3JsonStr.replace(reg, 'ref":"');
          swagger3Json = JSON.parse(swagger3JsonStr);
        } catch (error) { }
      }
      var validationResult = this.validate(swagger3Json);
      if (validationResult.status === 'error') {
        return validationResult;
      }

      this.handleInfo(swagger3Json);
      if (this.version == '2.0') {
        this.setBasePath(swagger3Json);
        await this.handlePaths(swagger3Json);
      } else if (this.version == '3.0') {
        this.handleServers(swagger3Json);
        console.log(JSON.stringify(validationResult));
        await this.handlePathsV3(swagger3Json);
      }

      // 添加空目录数据到apis
      this.handleGlobalTags(swagger3Json);

      if (this.version == '2.0') {
        this.handleModelData2(swagger3Json);
      } else {
        this.handleModelData(swagger3Json);
      }

      validationResult.data = {
        project: this.project,
        apis: this.apis,
        env: this.env,
        dataModel: this.dataModel,
      }
      // console.log(JSON.stringify(validationResult.data.dataModel));

      console.log(JSON.stringify(validationResult.data.apis));

      return validationResult;
    } catch (error: any) {
      // console.log(error, "error");
      if (error?.name === 'AbortError') {
        return ConvertResult('error', '数据过大，请求超时。')
      }
      return ConvertResult('error', String(error))
    }
  }
  endsWith(str: string, suffix: string) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }
}

export default Swagger2Apipost;
