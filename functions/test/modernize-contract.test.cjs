const test = require('node:test');
const assert = require('node:assert/strict');
const { readSettings, readiness, publicConfig, validateLead, pingPayload, postPayload, configVersion } = require('../lib/modernize-contract');
const { settings, lead } = require('./modernize-fixtures.cjs');

test('Modernize settings fail closed; production requires separate approval and correct certificates', () => {
  assert.equal(publicConfig(readSettings('{}')).enabled, false);
  assert.deepEqual(readiness(settings()), []);
  for (const patch of [
    { accountApproved: false }, { consentApproved: false }, { staticConsentApproved: false },
    { jornayaRequired: true }, { approvedServices: [] }, { approvedServices: ['WINDOWS'] },
    { environment: 'production' }, { consentText: '<script>invalid</script>' },
    { trustedFormScriptUrl: 'https://api.trustedform.com.evil.test/trustedform.js' },
    { allowedZips: ['wrong'] },
  ]) assert.equal(publicConfig(settings(patch)).enabled, false, JSON.stringify(patch));
  assert.equal(publicConfig(settings({ environment: 'production', productionApproved: true, tagId: '12345', trustedFormScriptUrl: settings().trustedFormScriptUrl.replace('sandbox=true', 'sandbox=false') })).enabled, true);
});
test('Hosted mode validates exact approved HTTPS hostname and never exposes API credentials', () => {
  const config = settings({ mode: 'hosted', affiliateUrl: 'https://modernize.com/roofing?affiliate=example', affiliateHostname: 'modernize.com' });
  assert.equal(publicConfig(config).enabled, true);
  for (const url of ['javascript:alert(1)', 'https://evil.test/', 'https://user:pass@modernize.com/', 'http://modernize.com/']) {
    assert.equal(publicConfig({ ...config, affiliateUrl: url }).enabled, false);
  }
  const visible = publicConfig(settings());
  assert.equal(visible.tagId, undefined);
  assert.equal(visible.sourceId, undefined);
});
test('Ping contains only project data and Post carries exact case-sensitive fields and approved consent', () => {
  const config = settings(), data = validateLead(lead(config), config);
  const ping = pingPayload(data, config);
  assert.deepEqual(Object.keys(ping).sort(), ['tagId','service','postalCode','buyTimeframe','ownHome','partnerSourceId','publisherSubId','RoofingPlan'].sort());
  assert.equal(ping.service, 'ROOFING_ASPHALT');
  assert.equal(ping.RoofingPlan, 'Completely replace roof');
  const post = postPayload(data, config, 'test-ping');
  assert.equal(post.pingToken, 'test-ping');
  assert.equal(post.homePhoneConsentLanguage, config.consentText);
  assert.equal(post.firstName, 'Synthetic');
  assert.equal(post.phone, '2105550123');
  assert.equal(post.trustedFormToken, data.trustedFormToken);
});
test('Unconsented, stale, unsupported or unverified submissions cannot be mapped', () => {
  const config = settings();
  for (const patch of [{consent:false}, {authorized:false}, {consentVersion:'old'}, {configVersion:'old'}, {material:'unknown'}, {material:'toString'}, {plan:'inspection'}, {phone:''}, {phone:'1111111111'}, {trustedFormToken:'https://evil.test/cert'}, {zip:'000'}, {state:'ZZ'}, {firstName:''}]) {
    assert.throws(() => validateLead(lead(config, patch), config), undefined, JSON.stringify(patch));
  }
  assert.notEqual(configVersion(config), configVersion({...config, consentText: config.consentText + ' Changed.'}));
  const restricted = settings({allowedZips:['02108']});
  assert.throws(() => validateLead(lead(restricted), restricted), /not currently available/);
});
