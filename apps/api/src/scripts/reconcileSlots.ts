import { reconcileAiJobSlots } from '../services/aiQuota.service.js';

async function main() {
  const args = process.argv.slice(2);
  const isFix = args.includes('--fix');
  const userArg = args.find((a) => a.startsWith('--userId='));
  const userId = userArg ? userArg.split('=')[1] : undefined;

  console.log(`=== STUDYFLOW AI ACTIVE JOB SLOT RECONCILIATION ===`);
  console.log(`Mode: ${isFix ? 'EXPLICIT REPAIR (--fix)' : 'DRY-RUN (default)'}`);
  if (userId) {
    console.log(`Target User: ${userId}`);
  } else {
    console.log(`Target: All users with AI usages or active AI jobs`);
  }
  console.log('----------------------------------------------------');

  const report = await reconcileAiJobSlots({
    userId,
    dryRun: !isFix,
  });

  console.log(`Total users checked: ${report.totalUsersChecked}`);
  console.log(`Discrepancies found: ${report.discrepanciesFound}`);

  if (report.details.length > 0) {
    console.log('\nDetails:');
    for (const d of report.details) {
      if (d.discrepancy !== 0) {
        console.log(
          ` - User: ${d.userId} | Recorded: ${d.recordedActiveJobs} | Actual Active Jobs: ${d.actualActiveJobs} | Diff: ${d.discrepancy > 0 ? '+' : ''}${d.discrepancy} | Action: ${d.action}`
        );
      }
    }
  }

  if (report.discrepanciesFound > 0 && !isFix) {
    console.log('\n[INFO] To apply fixes safely, re-run with: npx tsx src/scripts/reconcileSlots.ts --fix');
  } else if (report.discrepanciesFound > 0 && isFix) {
    console.log('\n[SUCCESS] All discrepancies safely repaired under row lock.');
  } else {
    console.log('\n[SUCCESS] All active job slots are consistent with database state.');
  }
}

main().catch((err) => {
  console.error('Fatal error during slot reconciliation:', err);
  process.exit(1);
});
