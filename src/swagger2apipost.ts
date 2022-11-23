import _url from 'url';
import SwaggerClient from 'swagger-client';
class Swagger2Apipost {
  version: string;
  project: any;
  basePath: string;
  apis: any[];
  folders: any;
  baseParams: any;
  globalConsumes: any;
  globalProduces: any;
  env: any[];
  options: any;
  constructor() {
    this.version = '2.0';
    this.project = {};
    this.basePath = '';
    this.apis = [];
    this.folders = {};
    this.baseParams = {};
    this.env = [];
    this.options = {
      basePath: true,
      host: true
    }
  }
  ConvertResult(status: string, message: string, data: any = '') {
    return {
      status,
      message,
      data
    }
  }
  getApipostMode(mode: string) {
    let apipostMode = 'none';
    if (mode == 'multipart/form-data') {
      apipostMode = 'form-data';
    } else if (mode == 'application/x-www-form-urlencoded') {
      apipostMode = 'urlencoded';
    } else if (mode && mode != undefined) {
      apipostMode = 'json';
    }
    return apipostMode;
  }
  validate(json: any) {
    if (json.hasOwnProperty('swagger')) {
      if (json.swagger !== '2.0') {
        return this.ConvertResult('error', 'Must contain a swagger field 2.0');
      } else {
        this.version = '2.0';
      }
    }
    if (json.hasOwnProperty('openapi')) {
      this.version = '3.0';
    }
    if (!json.hasOwnProperty('swagger') && !json.hasOwnProperty('openapi')) {
      return this.ConvertResult('error', 'Must contain a swagger field 2.0 or 3.0');
    }

    return this.ConvertResult('success', '');
  }
  handleBodyJsonSchema(result: any, properties: any, raw_para?: any) {
    for (const key in properties) {
      let type = 'string';
      let item = properties[key];
      if (item.hasOwnProperty('type') && typeof item.type === 'string') {
        type = item.type.toLowerCase();
      }
      if (type === 'object') {
        result[key] = {};

        if (item.hasOwnProperty('additionalProperties') && item?.additionalProperties) {
          this.handleBodyJsonSchema(result[key], item?.additionalProperties?.properties || {}, raw_para)
        } else {
          this.handleBodyJsonSchema(result[key], item?.properties || {}, raw_para)
        }
      } else if (type === 'array') {
        let arrayObj = {};
        result[key] = [arrayObj];
        if (item.hasOwnProperty('items') && item?.items) {
          if (item?.items.hasOwnProperty('oneOf') && item?.items?.oneOf) {
            this.handleBodyJsonSchema(arrayObj, item?.items?.oneOf?.[0]?.properties || {}, raw_para)
          } else {
            this.handleBodyJsonSchema(arrayObj, item?.items?.properties || {}, raw_para)
          }
        } else if (item.hasOwnProperty('additionalProperties') && item?.additionalProperties) {
          this.handleBodyJsonSchema(arrayObj, item?.additionalProperties?.properties || {}, raw_para)
        } else {
          this.handleBodyJsonSchema(arrayObj, item?.properties || {}, raw_para)
        }
      } else {
        let oneOfObj = {};
        // if (item.hasOwnProperty('oneOf') && item?.oneOf) {
        //   this.handleBodyJsonSchema(oneOfObj, item?.oneOf?.[0]?.properties || {}, raw_para)
        //   result[key] = oneOfObj;
        // } else {
          if (item.hasOwnProperty('description') && Object.prototype.toString.call(raw_para) === '[object Array]') {
            raw_para.push({
              key: key,
              value: item?.example || "",
              description: String(item.description),
              not_null: 1,
              field_type: type ? type.charAt(0).toUpperCase() + type.slice(1) : "Text",
              type: "Text",
              is_checked: 1,
            });
          }
          result[key] = item?.example || "";
        // }
      }
    }
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

    if (!this.endsWith(this.basePath, '/')) {
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
        name: server.url || '未命名环境',
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
    for (const tagString of tags) {
      let tagArray = tagString.split('/');
      for (let index = 1; index < tagArray.length + 1; index++) {
        const tag = tagArray[index - 1];
        const folderPath = tagArray.slice(0, index).join('/');
        const grandpaFolderPath = tagArray.slice(0, index - 1).join('/');
        if (!this.folders.hasOwnProperty(folderPath)) {
          this.folders[folderPath] = this.createNewFolder(tag, tagsInfo);
          if (index == 1) {
            this.apis.push(this.folders[folderPath]);
          } else {
            this.folders[grandpaFolderPath].children.push(this.folders[folderPath]);
          }
        }
      }
    }
  }
  handlePathV3(path: string, pathItem: any, tags: any) {
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
        'url': url || '',
        'method': method.toUpperCase() || 'GET',
        'request': {
          'description': swaggerApi?.description || '',
        },
        'response': {
          'success': {
            parameter: [],
            raw: ''
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
                value: parameter?.example || '', //参数值
                not_null: parameter.hasOwnProperty('required') && !parameter.required ? "-1" : "1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: "Text" // 类型
              })
            } else if (parameter.in == 'header') {
              if (!request.hasOwnProperty('header')) {
                request['header'] = [];
              }
              parameter?.name && request.header.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || '', //参数值
                not_null: parameter.hasOwnProperty('required') && !parameter.required ? "-1" : "1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: "Text" // 类型
              })
            } else if (parameter.in == 'path') {
              if (!request.hasOwnProperty('resful')) {
                request['resful'] = [];
              }
              parameter?.name && request.resful.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || '', //参数值
                not_null: parameter.hasOwnProperty('required') && !parameter.required ? "-1" : "1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: "Text" // 类型
              })
            }
          }
        }
      }

      if (swaggerApi.hasOwnProperty('requestBody') && swaggerApi.requestBody.hasOwnProperty('content')) {
        let content = swaggerApi.requestBody.content;
        let mode = content instanceof Object ? Object.keys(content)[0] : "none";
        let bodyData = content[mode];
        let apipostMode = this.getApipostMode(mode)
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
                not_null: "1",
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
          } else {
            if (JSON.stringify(properties) !== "{}") {
              let RawObj: any = {};
              let raw_para: any = [];
              this.handleBodyJsonSchema(RawObj, properties, raw_para);
              request.body.raw = JSON.stringify(RawObj);
              request.body.raw_para = raw_para;
            }
          }
        }
      }
      if (swaggerApi.hasOwnProperty('responses')) {
        let successRawObj = {};
        let errorRawObj = {};
        for (const status in swaggerApi.responses) {
          if (Object.prototype.hasOwnProperty.call(swaggerApi.responses, status)) {
            const element = swaggerApi.responses[status];
            if (element.hasOwnProperty('content') && Object.keys(element.content)?.length > 0) {
              let content = element.content;

              let mode = content instanceof Object ? Object.keys(content)[0] : "none";
              let bodyData = content[mode];
              let apipostMode = this.getApipostMode(mode)
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
                if (bodyData.hasOwnProperty('example')) {
                  let example = bodyData.example;
                  if (typeof example == 'object') {
                    if (/^2\d{2}$/.test(status)) {
                      successRawObj[status] = { ...example };
                    } else {
                      errorRawObj[status] = { ...example };
                    }
                  }
                } else {
                  if (JSON.stringify(properties) !== "{}") {
                    let RawObj: any = {};
                    this.handleBodyJsonSchema(RawObj, properties);
                    if (/^2\d{2}$/.test(status)) {
                      successRawObj[status] = { ...RawObj }
                    } else {
                      errorRawObj[status] = { ...RawObj }
                    }
                  }
                }
              }
            } else {
              if (/^2\d{2}$/.test(status)) {
                successRawObj[status] = element?.description || ""
              } else {
                errorRawObj[status] = element?.description || ""
              }
            }
          }
        }
        response.success.raw = JSON.stringify(successRawObj);
        response.error.raw = JSON.stringify(errorRawObj);
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
  handlePath(path: string, pathItem: any, tags: any) {
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
        'target_type': 'api',
        'url': url || '',
        'method': method.toUpperCase() || 'GET',
        'request': {
          'description': swaggerApi?.description || '',
        },
        'response': {
          'success': {
            'parameter': [],
            'raw': ''
          },
          'error': {
            'parameter': [],
            'raw': ''
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
          field_type: "Text"
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
          field_type: "Text"
        });
      }

      if (swaggerApi.hasOwnProperty('parameters')) {
        let mode = 'none'
        if (thisConsumes && thisConsumes.length > 0) {
          mode = thisConsumes[0]
        }
        let apipostMode = this.getApipostMode(mode);
        request.body = {
          "mode": apipostMode,
          "parameter": [],
          "raw": "",
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
                value: parameter?.example || parameter?.default || '', //参数值
                not_null: parameter.hasOwnProperty('required') && !parameter.required ? "-1" : "1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: "Text" // 类型
              })
            } else if (parameter.in == 'header') {
              if (!request.hasOwnProperty('header')) {
                request['header'] = [];
              }
              parameter?.name && request.header.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.default || '', //参数值
                not_null: parameter.hasOwnProperty('required') && !parameter.required ? "-1" : "1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: "Text" // 类型
              })
            } else if (parameter.in == 'path') {
              if (!request.hasOwnProperty('resful')) {
                request['resful'] = [];
              }
              parameter?.name && request.resful.push({
                is_checked: "1", // 是否选择
                type: "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.default || '', //参数值
                not_null: parameter.hasOwnProperty('required') && !parameter.required ? "-1" : "1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: "Text" // 类型
              })
            } else if (parameter.in == 'body') {
              if ((parameter.hasOwnProperty('schema') && parameter.schema.hasOwnProperty('properties') && JSON.stringify(parameter.schema.properties) !== "{}") || parameter?.schema?.type === 'array') {
                let RawObj = {};
                let raw_para:any = [];
                if (parameter.schema.type === 'array') {
                  this.handleBodyJsonSchema(RawObj, parameter.schema.items.properties, raw_para);
                } else {
                  this.handleBodyJsonSchema(RawObj, parameter.schema.properties, raw_para);
                }
                request.body.raw = JSON.stringify(RawObj);
              } else {
                request.body.raw = parameter?.description || ''
              }
            } else if (parameter.in == 'formData') {
              parameter.name && request.body.parameter.push({
                is_checked: "1", // 是否选择
                type: parameter.hasOwnProperty('type') && parameter.type == 'file' ? 'File' : "Text", // 参数值类型 Text/File
                key: parameter?.name || '', //参数名
                value: parameter?.example || parameter?.default || '', //参数值
                not_null: parameter.hasOwnProperty('required') && !parameter.required ? "-1" : "1", // 是否为空
                description: parameter?.description || '', // 参数描述
                field_type: "Text" // 类型
              })
            }
          }
        }
      }
      if (swaggerApi.hasOwnProperty('responses')) {
        let successRawObj = {};
        let errorRawObj = {};
        for (const status in swaggerApi.responses) {
          if (Object.prototype.hasOwnProperty.call(swaggerApi.responses, status)) {
            const element = swaggerApi.responses[status];
            if ((element.hasOwnProperty('schema') && element.schema.hasOwnProperty('properties') && JSON.stringify(element.schema.properties) !== "{}") || element?.schema?.type === 'array') {
              let RawObj = {};
              if (element.schema.type === 'array') {
                this.handleBodyJsonSchema(RawObj, element.schema.items.properties);
              } else {
                this.handleBodyJsonSchema(RawObj, element.schema.properties);
              }
              if (/^2\d{2}$/.test(status)) {
                successRawObj[status] = { ...RawObj }
              } else {
                errorRawObj[status] = { ...RawObj }
              }
            } else {
              if (/^2\d{2}$/.test(status)) {
                successRawObj[status] = element?.description || ''
              } else {
                errorRawObj[status] = element?.description || ''
              }
            }
          }
        }
        response.success.raw = JSON.stringify(successRawObj);
        response.error.raw = JSON.stringify(errorRawObj);
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
  handlePathsV3(json: any) {
    var paths = json.paths;
    var tags = json.tags;
    for (const path in paths) {
      this.handlePathV3(path, paths[path], tags);
    }
  }
  handlePaths(json: any) {
    var paths = json.paths;
    var tags = json.tags;
    for (const path in paths) {
      this.handlePath(path, paths[path], tags);
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
    return newFolder;
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
        await SwaggerClient.resolve({ url: json }).then((swaggerJson: any) => {
          swagger3Json = swaggerJson.spec;
        })
      }
      var validationResult = this.validate(swagger3Json);
      if (validationResult.status === 'error') {
        return validationResult;
      }
      this.handleInfo(swagger3Json);
      if (this.version == '2.0') {
        this.setBasePath(swagger3Json);
        this.handlePaths(swagger3Json);
      } else if (this.version == '3.0') {
        this.handleServers(swagger3Json);
        this.handlePathsV3(swagger3Json);
      }

      validationResult.data = {
        project: this.project,
        apis: this.apis,
        env: this.env,
      }
      return validationResult;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return this.ConvertResult('error', '数据过大，请求超时。')
      }
      return this.ConvertResult('error', String(error))
    }
  }
  endsWith(str: string, suffix: string) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }
}

export default Swagger2Apipost;
