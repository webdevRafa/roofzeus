const { randomUUID } = require('node:crypto');
const { readSettings, configVersion } = require('../lib/modernize-contract');
const settings = (patch = {}) => readSettings(JSON.stringify({
  mode: 'api', environment: 'staging', accountApproved: true,
  productionApproved: false, consentApproved: true, staticConsentApproved: true,
  jornayaRequired: false, tagId: '204670250', sourceId: 'roofzeus_test',
  consentText: 'TEST FIXTURE ONLY. I consent to the described test introduction. This is not approved production consent.',
  consentVersion: 'test-v1',
  trustedFormScriptUrl: 'https://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&use_tagged_consent=true&sandbox=true',
  approvedServices: ['ROOFING_ASPHALT', 'ROOFING_METAL'], allowedZips: [], ...patch,
}));
const lead = (config = settings(), patch = {}) => ({
  requestId: randomUUID(), configVersion: configVersion(config), consentVersion: config.consentVersion,
  firstName: 'Synthetic', lastName: 'Homeowner', email: 'synthetic@example.com', phone: '2105550123',
  address: '123 Example Lane', city: 'San Antonio', state: 'TX', zip: '78209',
  material: 'asphalt', plan: 'replacement', timeframe: 'Immediately',
  authorized: true, consent: true, trustedFormToken: 'https://cert.trustedform.com/' + 'a'.repeat(40), ...patch,
});
module.exports = { settings, lead };
