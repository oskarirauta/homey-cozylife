const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isGangOn, calcNewBitmask, parseBitmaskFromData } = require('../.homeybuild/lib/CozyLifeClient');

describe('CozyLife Bitmask Operations', () => {
  it('should correctly determine gang state for 1-gang switch', () => {
    assert.equal(isGangOn(0, 0), false);
    assert.equal(isGangOn(1, 0), true);
  });

  it('should calculate new bitmask for 1-gang switch', () => {
    assert.equal(calcNewBitmask(0, 0, true), 1);
    assert.equal(calcNewBitmask(1, 0, false), 0);
  });

  it('should correctly determine gang states for 2-gang switch', () => {
    assert.equal(isGangOn(0, 0), false);
    assert.equal(isGangOn(0, 1), false);

    assert.equal(isGangOn(1, 0), true);
    assert.equal(isGangOn(1, 1), false);

    assert.equal(isGangOn(2, 0), false);
    assert.equal(isGangOn(2, 1), true);

    assert.equal(isGangOn(3, 0), true);
    assert.equal(isGangOn(3, 1), true);
  });

  it('should calculate new bitmask for 2-gang switch toggling', () => {
    let mask = 0; // Both OFF

    // Turn gang 0 ON -> 1
    mask = calcNewBitmask(mask, 0, true);
    assert.equal(mask, 1);

    // Turn gang 1 ON -> 3
    mask = calcNewBitmask(mask, 1, true);
    assert.equal(mask, 3);

    // Turn gang 0 OFF -> 2
    mask = calcNewBitmask(mask, 0, false);
    assert.equal(mask, 2);

    // Turn gang 1 OFF -> 0
    mask = calcNewBitmask(mask, 1, false);
    assert.equal(mask, 0);
  });

  it('should correctly handle 4-gang switch states (0 to 15)', () => {
    // 0b1010 = 10 (gang 1 & gang 3 on, gang 0 & 2 off)
    const mask = 10;
    assert.equal(isGangOn(mask, 0), false); // bit 0 (1) -> 0
    assert.equal(isGangOn(mask, 1), true);  // bit 1 (2) -> 1
    assert.equal(isGangOn(mask, 2), false); // bit 2 (4) -> 0
    assert.equal(isGangOn(mask, 3), true);  // bit 3 (8) -> 1

    // Turn gang 2 ON -> 10 + 4 = 14 (0b1110)
    const maskAfter = calcNewBitmask(mask, 2, true);
    assert.equal(maskAfter, 14);
    assert.equal(isGangOn(maskAfter, 2), true);

    // Turn all 4 ON -> 15 (0b1111)
    const maskAllOn = calcNewBitmask(maskAfter, 0, true);
    assert.equal(maskAllOn, 15);
    for (let i = 0; i < 4; i++) {
      assert.equal(isGangOn(maskAllOn, i), true);
    }

    // Turn gang 1 OFF -> 15 - 2 = 13
    const maskWithoutGang1 = calcNewBitmask(maskAllOn, 1, false);
    assert.equal(maskWithoutGang1, 13);
    assert.equal(isGangOn(maskWithoutGang1, 1), false);
    assert.equal(isGangOn(maskWithoutGang1, 0), true);
    assert.equal(isGangOn(maskWithoutGang1, 2), true);
    assert.equal(isGangOn(maskWithoutGang1, 3), true);
  });

  describe('parseBitmaskFromData (CozyLife Protocol Bitmask)', () => {
    it('should extract bitmask for Gang 1 ON (1)', () => {
      const res = parseBitmaskFromData({ '1': 1, '2': 0, '4': 0 }, 0);
      assert.equal(res.bitmask, 1);
      assert.equal(res.hasChange, true);
      assert.equal(isGangOn(res.bitmask, 0), true);
      assert.equal(isGangOn(res.bitmask, 1), false);
    });

    it('should extract bitmask for Gang 2 ON (2)', () => {
      const res = parseBitmaskFromData({ '1': 2, '2': 0, '4': 0 }, 0);
      assert.equal(res.bitmask, 2);
      assert.equal(res.hasChange, true);
      assert.equal(isGangOn(res.bitmask, 0), false);
      assert.equal(isGangOn(res.bitmask, 1), true);
    });

    it('should extract bitmask for both Gang 1 and Gang 2 ON (3)', () => {
      const res = parseBitmaskFromData({ '1': 3, '2': 0, '4': 0 }, 2);
      assert.equal(res.bitmask, 3);
      assert.equal(res.hasChange, true);
      assert.equal(isGangOn(res.bitmask, 0), true);
      assert.equal(isGangOn(res.bitmask, 1), true);
    });

    it('should extract bitmask for all OFF (0)', () => {
      const res = parseBitmaskFromData({ '1': 0, '2': 0, '4': 0 }, 3);
      assert.equal(res.bitmask, 0);
      assert.equal(res.hasChange, true);
      assert.equal(isGangOn(res.bitmask, 0), false);
      assert.equal(isGangOn(res.bitmask, 1), false);
    });

    it('should return hasChange=false if bitmask is unchanged', () => {
      const res = parseBitmaskFromData({ '1': 2, '2': 0, '4': 0 }, 2);
      assert.equal(res.bitmask, 2);
      assert.equal(res.hasChange, false);
    });

    it('should correctly handle multi-gang states up to 4 gangs', () => {
      // Gang 3 (bit 2 = 4)
      const resGang3 = parseBitmaskFromData({ '1': 4 }, 0);
      assert.equal(isGangOn(resGang3.bitmask, 2), true);

      // Gang 4 (bit 3 = 8)
      const resGang4 = parseBitmaskFromData({ '1': 8 }, 0);
      assert.equal(isGangOn(resGang4.bitmask, 3), true);

      // All 4 gangs (15 = 1 + 2 + 4 + 8)
      const resAll = parseBitmaskFromData({ '1': 15 }, 0);
      for (let i = 0; i < 4; i++) {
        assert.equal(isGangOn(resAll.bitmask, i), true);
      }
    });
  });
});
