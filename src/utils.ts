export const ConvertResult = (status: string, message: string, data: any = '')=> {
  return {
    status,
    message,
    data
  }
}

export const getApipostMode=(mode: string)=> {
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

export const  handleBodyJsonSchema =(result: any, properties: any, raw_para?: any)=> {
  for (const key in properties) {
    let type = 'string';
    let item = properties[key];
    if (item.hasOwnProperty('type') && typeof item.type === 'string') {
      type = item.type.toLowerCase();
    }
    if (type === 'object') {
      result[key] = {};

      if (item.hasOwnProperty('additionalProperties') && item?.additionalProperties) {
        handleBodyJsonSchema(result[key], item?.additionalProperties?.properties || {}, raw_para)
      } else {
        handleBodyJsonSchema(result[key], item?.properties || {}, raw_para)
      }
    } else if (type === 'array') {
      let arrayObj = {};
      result[key] = [arrayObj];
      if (item.hasOwnProperty('items') && item?.items) {
        if (item?.items.hasOwnProperty('oneOf') && item?.items?.oneOf) {
          handleBodyJsonSchema(arrayObj, item?.items?.oneOf?.[0]?.properties || {}, raw_para)
        } else {
          handleBodyJsonSchema(arrayObj, item?.items?.properties || {}, raw_para)
        }
      } else if (item.hasOwnProperty('additionalProperties') && item?.additionalProperties) {
        handleBodyJsonSchema(arrayObj, item?.additionalProperties?.properties || {}, raw_para)
      } else {
        handleBodyJsonSchema(arrayObj, item?.properties || {}, raw_para)
      }
    } else {
      let oneOfObj = {};
      // if (item.hasOwnProperty('oneOf') && item?.oneOf) {
      //   handleBodyJsonSchema(oneOfObj, item?.oneOf?.[0]?.properties || {}, raw_para)
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