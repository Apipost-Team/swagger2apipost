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
  setBasePath(json: any) {
    this.basePath = '';
    if (json.host && this.options.host) {
      this.basePath = json.host;
    }


    if (json.basePath && this.options.basePath) {
      this.basePath += json.basePath;
    }

    if (json.schemes && json.schemes.indexOf('https') != -1) {
      this.basePath = 'https://' + this.basePath;
    }
    else {
      this.basePath = 'http://' + this.basePath;
    }

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
  handleTags(tags: any[]) {
    for (const tagString of tags) {
      let tagArray = tagString.split('/');
      for (let index = 1; index < tagArray.length + 1; index++) {
        const tag = tagArray[index - 1];
        const folderPath = tagArray.slice(0, index).join('/');
        const grandpaFolderPath = tagArray.slice(0, index - 1).join('/');
        if (!this.folders.hasOwnProperty(folderPath)) {
          this.folders[folderPath] = this.createNewFolder(tag);
          if (index == 1) {
            this.apis.push(this.folders[folderPath]);
          } else {
            console.log('this.folders',grandpaFolderPath,JSON.stringify(this.folders));
            
            this.folders[grandpaFolderPath].children.push(this.folders[folderPath]);
          }
        }
      }
    }
  }
  handlePathV3(path: string, pathItem: any) {
    let url = path;
    // if(this.options.basePath){
    //   url=decodeURI(_url.resolve(this.basePath, path))
    // }
    if (path.charAt(0) == '/') {
      url = path.substring(1);
    }
    for (const method in pathItem) {
      let swaggerApi = pathItem[method];
      if (swaggerApi.hasOwnProperty('tags') && swaggerApi.tags.length > 0) {
        this.handleTags(swaggerApi.tags);
      }
      let api: any = {
        'name': swaggerApi?.summary || '新建接口',
        'target_type': 'api',
        'url': url || '',
        'method': method.toUpperCase() || 'GET',
        'request': {
          'description': swaggerApi?.description || '',
        }
      }
      const { request } = api;
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
        let mode = Object.keys(content)[0];
        let bodyData = content[mode];
        let apipostMode = this.getApipostMode(mode)
        let properties: any = {};
        if (bodyData.hasOwnProperty('schema')) {
          let { schema } = bodyData;
          if (schema.hasOwnProperty('properties')) {
            properties = schema.properties;
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
          }
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
  handlePath(path: string, pathItem: any) {
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
        this.handleTags(swaggerApi.tags);
      }
      let api: any = {
        'name': swaggerApi?.summary || '新建接口',
        'target_type': 'api',
        'url': url || '',
        'method': method.toUpperCase() || 'GET',
        'request': {
          'description': swaggerApi?.description || '',
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
        let mode = thisConsumes[0];
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
              request.body.raw = parameter?.description || ''
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
    for (const path in paths) {
      this.handlePathV3(path, paths[path]);
    }
  }
  handlePaths(json: any) {
    var paths = json.paths;
    for (const path in paths) {
      this.handlePath(path, paths[path]);
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
  createNewFolder(name: string) {
    var newFolder = {
      'name': name,
      'target_type': 'folder',
      'description': 'Folder for ' + name,
      'children': [],
    };
    return newFolder;
  }
  async convert(json: object, options: any = null) {
    try {
      var validationResult = this.validate(json);
      if (validationResult.status === 'error') {
        return validationResult;
      }
      if (options && options instanceof Object) {
        this.options = { ...this.options, ...options };
      }
      let swagger3Json = {};
      this.handleInfo(json);
      await SwaggerClient.resolve({ spec: json }).then((swaggerJson: any) => {
        swagger3Json = swaggerJson.spec;
      });

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
      console.log('project', JSON.stringify(validationResult));
      return validationResult;
    } catch (error) {
      console.log('project', JSON.stringify(String(error)));
      return this.ConvertResult('error', String(error))
    }
  }
  endsWith(str: string, suffix: string) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }
}

export default Swagger2Apipost;
