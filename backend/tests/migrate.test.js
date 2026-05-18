import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const migrateSource = readFileSync(join(dir, '../db/migrate.js'), 'utf8');
const goalControllerSource = readFileSync(join(dir, '../controllers/goalController.js'), 'utf8');

describe('schema contract (createGoal vs migrations)', () => {
  it('migrate.js bootstraps empty DB and adds uom_direction and goal_sheet_status', () => {
    assert.match(migrateSource, /CREATE TABLE IF NOT EXISTS users/);
    assert.match(migrateSource, /uom_direction/);
    assert.match(migrateSource, /goal_sheet_status/);
    assert.match(goalControllerSource, /uom_direction/);
    assert.match(goalControllerSource, /goal_sheet_status/);
  });

  it('createGoal targets sheet owner via resolveSheetUserId, not only req.user.id', () => {
    assert.match(goalControllerSource, /resolveSheetUserId/);
    assert.match(goalControllerSource, /targetUserId/);
    assert.doesNotMatch(goalControllerSource, /INSERT INTO goals[\s\S]*?\[userId,/);
  });
});
