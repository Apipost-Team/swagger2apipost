import { isEmpty } from "lodash";

export const ConvertResult = (status: string, message: string, data: any = '') => {
  return {
    status,
    message,
    data
  }
}

export const getApipostMode = (mode: string) => {
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

export const handleBodyJsonSchema = (schema: any, raw_para?: any, pre = '', requiredArr = [], propName = '') => {
  requiredArr = (requiredArr && Array.isArray(requiredArr)) ? requiredArr : []
  
  let type = schema?.type ? schema.type.toLowerCase() : 'string';
  if (type === "object") {
    let properties = schema?.additionalProperties?.properties || schema?.properties || {}
    
    const example = {};
    for (const key in properties) {
      if (properties.hasOwnProperty(key)) {
        const item = properties[key];
        example[key] = handleBodyJsonSchema(item, raw_para, pre ? `${pre}.${key}` : `${key}`, schema?.required, key);
      }
    }
    if(pre){
      raw_para.push({
        key: `${pre}`,
        value: schema?.example || schema?.default || "{}",,
        description: String(schema?.description || ''),
        not_null: requiredArr?.find(it => it == propName) ? "1" : "-1",
        field_type: type ? type.charAt(0).toUpperCase() + type.slice(1) : "Text",
        type: "Text",
        is_checked: 1,
      });
    }
    return example;
  } else if (type === "array") {
    const example:any = [];
    raw_para.push({
      key: `${pre}`,
      value: "",
      description: String(schema?.description || ''),
      not_null: requiredArr?.find(it => it == propName) ? "1" : "-1",
      field_type: "Array",
      type: "Text",
      is_checked: 1,
    });
    let itemsType = schema?.items?.oneOf?.[0]?.type || schema?.items?.type || 'string'
    if(itemsType === 'object'){
      let properties = schema?.items?.oneOf?.[0]?.properties || schema?.items?.properties || schema?.additionalProperties?.properties || schema?.properties || {}
      let required = schema?.items?.oneOf?.[0]?.required || schema?.items?.required || schema?.additionalProperties?.required || schema?.required || [];
      
      let obj = {};
      for (const key in properties) {
        if (properties.hasOwnProperty(key)) {
          const item = properties[key];
          obj[key] = handleBodyJsonSchema(item, raw_para, pre ? `${pre}.${key}` : `${key}`, required, propName);
        }
      }
      example.push(obj);
    }else if(itemsType === "integer"){
      let value = schema?.items?.oneOf?.[0]?.example || schema?.items?.example || 0
      // console.log(value,"valuevalue");
      
      if (Object.prototype.toString.call(raw_para) === '[object Array]') {
        raw_para.push({
          key: `${pre}.0`,
          value: value || 0,
          description: String(schema?.description || ''),
          not_null: requiredArr?.find(it => it == propName) ? "1" : "-1",
          field_type: type ? type.charAt(0).toUpperCase() + type.slice(1) : "Text",
          type: "Text",
          is_checked: 1,
        });
      }
      example.push(value);
    }else{
      let value = schema?.items?.oneOf?.[0]?.example || schema?.items?.example || ''
      if (Object.prototype.toString.call(raw_para) === '[object Array]') {
        raw_para.push({
          key: `${pre}.0`,
          value: value || '',
          description: String(schema?.description || ''),
          not_null: requiredArr?.find(it => it == propName) ? "1" : "-1",
          field_type: type ? type.charAt(0).toUpperCase() + type.slice(1) : "Text",
          type: "Text",
          is_checked: 1,
        });
      }
      example.push(value);
    }

    return example;
  } else if (type === "integer") {
    if (Object.prototype.toString.call(raw_para) === '[object Array]') {
      raw_para.push({
        key: `${pre}`,
        value: schema?.example || schema?.default || 0,
        description: String(schema?.description || ''),
        not_null: requiredArr?.find(it => it == propName) ? "1" : "-1",
        field_type: type ? type.charAt(0).toUpperCase() + type.slice(1) : "Text",
        type: "Text",
        is_checked: 1,
      });
    }
    return schema?.example || schema?.default || 0;
  } else {
    if (Object.prototype.toString.call(raw_para) === '[object Array]') {
      raw_para.push({
        key: `${pre}`,
        value: schema?.example || schema?.default || "",
        description: String(schema?.description || ''),
        not_null: requiredArr?.find(it => it == propName) ? "1" : "-1",
        field_type: type ? type.charAt(0).toUpperCase() + type.slice(1) : "Text",
        type: "Text",
        is_checked: 1,
      });
    }
    return schema?.example || schema?.default || "";
  }
}