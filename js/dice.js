export function rollDie(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

export function rollDice(count, sides) {
  const rolls = [];
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    const r = rollDie(sides);
    rolls.push(r);
    total += r;
  }
  return { total, rolls, sides, count };
}

export function rollD20() {
  return rollDie(20);
}

export function roll2d6() {
  return rollDice(2, 6);
}

// Parses simple dice notation like "d6", "1d8", "3d6".
export function parseDiceNotation(notation) {
  const match = /^(\d*)d(\d+)$/i.exec(String(notation).trim());
  if (!match) {
    throw new Error(`Notación de dado inválida: ${notation}`);
  }
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  return rollDice(count, sides);
}

// A Knave check: d20 + ability score + modifiers, vs (11 + difficulty).
export function resolveCheck({ abilityScore = 0, difficulty = 5, modifiers = 0 }) {
  const d20 = rollD20();
  const total = d20 + abilityScore + modifiers;
  const targetNumber = 11 + difficulty;
  return {
    d20,
    abilityScore,
    modifiers,
    total,
    targetNumber,
    success: total >= targetNumber,
  };
}

// A Knave attack: d20 + attack ability vs (11 + armor points).
export function resolveAttack({ attackAbility = 0, armorPoints = 0, modifiers = 0 }) {
  const d20 = rollD20();
  const total = d20 + attackAbility + modifiers;
  const armorClass = 11 + armorPoints;
  return {
    d20,
    total,
    armorClass,
    hit: total >= armorClass,
    freeManeuver: total >= 21,
    weaponBreaks: d20 === 1,
  };
}
