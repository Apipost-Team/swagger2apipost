import url from 'url';
let SwaggerClient = require('swagger-client');
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
  constructor() {
    this.version = '2.0';
    this.project = {};
    this.basePath = '';
    this.apis = [];
    this.folders = {};
    this.baseParams = {};
    this.env = [];
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
    if (json.host) {
      this.basePath = json.host;
    }
    if (json.basePath) {
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
        }
        if (index == 1) {
          this.apis.push(this.folders[folderPath]);
        } else {
          this.folders[grandpaFolderPath].children.push(this.folders[folderPath]);
        }
      }
    }
  }
  handlePath(path: string, pathItem: any) {
    let url = path;
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
                field_type: "" // 类型
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
                field_type: "" // 类型
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
                field_type: "" // 类型
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
  handlePathsV3(json: any) {
    var paths = json.paths;
    for (const path in paths) {
      this.handlePath(path, paths[path]);
    }
  }
  handlePaths(json: any) {
    var paths = json.paths,
      path,
      folderName;

    for (path in paths) {
      if (paths.hasOwnProperty(path)) {
        folderName = this.getFolderNameForPath(path);
        this.addPathItemToFolder(path, paths[path], folderName);
      }
    }
  }
  getFolderNameForPath(pathUrl: string) {
    if (pathUrl == '/') {
      return null;
    }
    var segments = pathUrl.split('/'),
      numSegments = segments.length,
      folderName = null;
    if (numSegments > 1) {
      folderName = segments[1];

      if (!this.folders[folderName]) {
        this.folders[folderName] = this.createNewFolder(folderName);
      }
      return this.folders[folderName].name;
    }
    else {
      return null;
    }
  }
  addPathItemToFolder(path: string, pathItem: any, folderName: string) {
    if (pathItem.$ref) {
      return;
    }

    var paramsForPathItem = this.getParamsForPathItem(this.baseParams, pathItem.parameters),
      acceptedVerbs = [
        'get', 'put', 'post', 'patch', 'delete', 'copy', 'head', 'options',
        'link', 'unlink', 'purge', 'lock', 'unlock', 'propfind', 'view'],
      numVerbs = acceptedVerbs.length,
      i,
      verb;

    if (path) {
      path = path.replace(/{/g, ':').replace(/}/g, '');
    }

    for (i = 0; i < numVerbs; i++) {
      verb = acceptedVerbs[i];
      if (pathItem[verb]) {
        this.addOperationToFolder(
          path,
          verb.toUpperCase(),
          pathItem[verb],
          folderName,
          paramsForPathItem
        );
      }
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
  addOperationToFolder(path: string, method: string, operation: any, folderName: string, params: any) {
    var root = this,
      api: any = {
        'name': '新建接口',
        'target_type': 'api',
        'url': '',
        'method': 'GET',
        'request': {
          'header': [],
          'description': operation.description || '',
        },
        'pathVariables': {},
      },
      thisParams = this.getParamsForPathItem(params, operation.parameters),
      hasQueryParams = false,
      param,
      defaultVal,
      thisConsumes = root.globalConsumes,
      thisProduces = root.globalProduces,
      tempBasePath;

    if (path.length > 0 && path[0] === '/') {
      path = path.substring(1);
    }
    const { request } = api;
    tempBasePath = this.basePath;

    api.url = decodeURI(url.resolve(tempBasePath, path));

    api.method = method;
    api.name = operation.summary;

    if (operation.produces) {
      thisProduces = operation.produces;
    }

    if (operation.consumes) {
      thisConsumes = operation.consumes;
    }

    if (thisConsumes && thisConsumes.indexOf('application/x-www-form-urlencoded') > -1) {
      request.body = {
        "mode": "urlencoded",
        "parameter": [],
        "raw": "",
        "raw_para": []
      };
    }

    if (thisProduces && thisProduces.length > 0) {
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

    for (param in thisParams) {
      if (thisParams.hasOwnProperty(param) && thisParams[param]) {

        defaultVal = '{{' + thisParams[param].name + '}}';
        if (thisParams[param].hasOwnProperty('default')) {
          defaultVal = thisParams[param].default;
        }

        if (thisParams[param].in === 'query') {
          if (!hasQueryParams) {
            hasQueryParams = true;
            api.url += '?';
          }
          api.url += thisParams[param].name + '=' + defaultVal + '&';
        }

        else if (thisParams[param].in === 'header') {
          thisParams[param].name && request.header.push({
            is_checked: "1",
            type: 'Text',
            key: thisParams[param].name,
            value: defaultVal || "",
            not_null: "1",
            description: "",
            field_type: "Text"
          });
        }

        else if (thisParams[param].in === 'body') {
          request.body = {
            "mode": "json",
            "parameter": [],
            "raw": thisParams[param].description,
            "raw_para": []
          }
        }

        else if (thisParams[param].in === 'formData') {
          if (thisConsumes && thisConsumes.indexOf('application/x-www-form-urlencoded') > -1) {
            request.body = {
              "mode": "urlencoded",
              "parameter": [],
              "raw": '',
              "raw_para": []
            }
          }
          else {
            request.body = {
              "mode": "form-data",
              "parameter": [],
              "raw": '',
              "raw_para": []
            }
          }
          request.body.parameter.push(
            {
              is_checked: "1",
              type: 'Text',
              key: thisParams[param].name || "",
              value: defaultVal || "",
              not_null: "1",
              description: "",
              field_type: "Text"
            })
        }
        else if (thisParams[param].in === 'path') {
          if (!api.hasOwnProperty('pathVariables')) {
            api.pathVariables = {};
          }
          // api.pathVariables[thisParams[param].name] = defaultVal;
        }
      }
    }

    if (hasQueryParams && this.endsWith(api.url, '&')) {
      api.url = api.url.slice(0, -1);
    }
    this.folders[folderName].children.push(api);
  }
  addFoldersToCollection() {
    var folderName;
    for (folderName in this.folders) {
      if (this.folders.hasOwnProperty(folderName)) {
        this.apis.push(this.folders[folderName]);
      }
    }
  }
  async convert(json: object) {
    try {
      var validationResult = this.validate(json);
      if (validationResult.status === 'error') {
        return validationResult;
      }
      this.handleInfo(json);
      if (this.version == '2.0') {
        this.setBasePath(json);
        this.handlePaths(json);
        this.addFoldersToCollection();
      } else if (this.version == '3.0') {
        let swagger3Json = {};
        await SwaggerClient.resolve({ spec: json }).then((swaggerJson: any) => {
          swagger3Json = swaggerJson.spec;
        });
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
      return this.ConvertResult('error', String(error))
    }
  }
  endsWith(str: string, suffix: string) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }
}

export default Swagger2Apipost;
