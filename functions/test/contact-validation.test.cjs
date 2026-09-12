const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, normalizePhone } = require('../lib/contact-validation');
const { validateLead } = require('../lib/modernize-contract');
const { settings, lead } = require('./modernize-fixtures.cjs');

test('Phone syntax accepts a national number and common +1 formats without accepting extensions or letters', () => {
  for (const input of ['2105550123', '(210) 555-0123', '+1 (210) 555-0123', '12105550123', ' 210.555.0123 ']) {
    assert.equal(normalizePhone(input), '2105550123', input);
  }
  for (const input of ['', '210555012', '21055501234', '2105550123dd', '(210) 555-0123 ext 4', '+4420123456', '+44 20 7946 0958', '1105550123', '2101550123', '2105550123\nextra', '210/555/0123']) {
    assert.equal(normalizePhone(input), null, input);
  }
});

test('Email syntax preserves valid plus tags and punctuation while rejecting malformed domains and local parts', () => {
  for (const input of ['name@example.com', ' First.Last+Roof@Example.COM ', "o'neil@example.co.uk", 'name@sub.example.com', 'name@xn--bcher-kva.de']) {
    assert.equal(normalizeEmail(input), input.trim().toLowerCase());
  }
  for (const input of ['', 'name', 'name@', 'name@example', 'name@@example.com', 'name space@example.com', 'name@example..com', 'name@-example.com', 'name@example-.com', 'name@exam_ple.com', '.name@example.com', 'name.@example.com', 'first..last@example.com', 'name@example.123', 'name@example.c', 'a'.repeat(65)+'@example.com']) {
    assert.equal(normalizeEmail(input), null, input);
  }
});

test('The actual lead validator rejects malformed contacts even when browser validation is bypassed', () => {
  const config = settings();
  for (const patch of [{phone:'2105550123dd'}, {phone:'2105550123 x9'}, {phone:'+4420123456'}, {email:'name@example..com'}, {email:'name@-example.com'}, {email:'first..last@example.com'}]) {
    assert.throws(() => validateLead(lead(config,patch),config));
  }
  const result = validateLead(lead(config,{phone:'+1 (210) 555-0123',email:' Name+Roof@Example.COM '}),config);
  assert.equal(result.phone,'2105550123');
  assert.equal(result.email,'name+roof@example.com');
});
