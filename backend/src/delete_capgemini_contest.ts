import prisma from './lib/prisma.js';

async function main() {
  const targetId = '180e5621-74e5-477d-a541-a868f0f2901b';
  
  console.log(`Deleting contest with ID: "${targetId}"...`);
  
  // Delete related records in cascade order
  await prisma.contestProblem.deleteMany({ where: { contestId: targetId } }).catch(e => console.warn('contestProblem err:', e.message));
  await prisma.contestRegistration.deleteMany({ where: { contestId: targetId } }).catch(e => console.warn('contestRegistration err:', e.message));
  await prisma.submission.deleteMany({ where: { contestId: targetId } }).catch(e => console.warn('submission err:', e.message));
  await prisma.proctoringLog.deleteMany({ where: { contestId: targetId } }).catch(e => console.warn('proctoringLog err:', e.message));
  await prisma.contestAssignment.deleteMany({ where: { contestId: targetId } }).catch(e => console.warn('contestAssignment err:', e.message));
  await prisma.contestSection.deleteMany({ where: { contestId: targetId } }).catch(e => console.warn('contestSection err:', e.message));

  // Delete contest
  const deleted = await prisma.contest.delete({ where: { id: targetId } });
  console.log('Successfully deleted contest from database:', deleted);

  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to delete contest:', err);
  process.exit(1);
});
