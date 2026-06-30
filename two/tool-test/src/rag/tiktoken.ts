import { getEncodingNameForModel, getEncoding } from 'js-tiktoken'

const modelName = 'gpt-4o'

const encodingName = getEncodingNameForModel(modelName)

console.log(encodingName);

