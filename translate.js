const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const LANGUAGES_70 = [
  {code:'af',name:'Afrikaans'},
  {code:'sq',name:'Albanian'},
  {code:'ar',name:'Arabic'},
  {code:'hy',name:'Armenian'},
  {code:'az',name:'Azerbaijani'},
  {code:'bn',name:'Bengali'},
  {code:'bs',name:'Bosnian'},
  {code:'bg',name:'Bulgarian'},
  {code:'ca',name:'Catalan'},
  {code:'zh-Hans',name:'Chinese (Simplified)'},
  {code:'zh-Hant',name:'Chinese (Traditional)'},
  {code:'hr',name:'Croatian'},
  {code:'cs',name:'Czech'},
  {code:'da',name:'Danish'},
  {code:'nl',name:'Dutch'},
  {code:'et',name:'Estonian'},
  {code:'fi',name:'Finnish'},
  {code:'fr',name:'French'},
  {code:'ka',name:'Georgian'},
  {code:'de',name:'German'},
  {code:'el',name:'Greek'},
  {code:'gu',name:'Gujarati'},
  {code:'he',name:'Hebrew'},
  {code:'hi',name:'Hindi'},
  {code:'hu',name:'Hungarian'},
  {code:'is',name:'Icelandic'},
  {code:'id',name:'Indonesian'},
  {code:'it',name:'Italian'},
  {code:'ja',name:'Japanese'},
  {code:'kn',name:'Kannada'},
  {code:'kk',name:'Kazakh'},
  {code:'km',name:'Khmer'},
  {code:'lo',name:'Lao'},
  {code:'lv',name:'Latvian'},
  {code:'lt',name:'Lithuanian'},
  {code:'mk',name:'Macedonian'},
  {
