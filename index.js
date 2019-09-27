const AWS = require('aws-sdk');
AWS.config.update({ region: 'ap-southeast-1' });    // Modifying to the selected Region.

const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('util');

const encrypted = process.env['account_key'];       // Set "account_key" in AWS Lambda Environment variables.
let decrypted;

let api;

function processEvent(event, context, callback) {
  const signatureProvider = new JsSignatureProvider([decrypted]);
  // Set EOS API endpoint.
  // https://www.eosdocs.io/resources/apiendpoints/
  const rpc = new JsonRpc('https://eos.greymass.com:443', { fetch });     
  api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
  
  asyncMain().then(function(ret) {
    console.log("Response : \n" + JSON.stringify(ret, null, 2));
    callback(null, ret);
  }).catch(function(err) {
    console.log('\nCaught exception: ' + err);
        if (err instanceof RpcError)
          console.log(JSON.stringify(err.json, null, 2));
      callback(err);
  });
}

async function asyncMain() {
  let result = null;
  result = await api.transact({
    actions: [{
      account: 'betdividends',
      name: 'claimdivs',
      authorization: [{
        actor: 'eosaccountname',          // Set eosacountname
        permission: 'active',
      }],
      data: {
        owner: 'eosaccountname'           // Set eosaccountname
      }
    }]
  }, {
    blocksBehind: 3,
    expireSeconds: 30,
  });
  return result;
}

exports.handler = (event, context, callback) => {
    if (decrypted) {
        processEvent(event, context, callback);
    } else {
        // Decrypt code should run once and variables stored outside of the
        // function handler so that these are decrypted once per container
        const kms = new AWS.KMS();
        kms.decrypt({ CiphertextBlob: Buffer.from(encrypted, 'base64') }, (err, data) => {
            if (err) {
                console.log('Decrypt error:', err);
                return callback(err);
            }
            decrypted = data.Plaintext.toString('ascii');
            processEvent(event, context, callback);
        });
    }
};
