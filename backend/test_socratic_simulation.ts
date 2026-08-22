import { getOrCreateSession, processCandidateMessage, getWelcomeMessage } from './src/services/assistant/assistant.service';

async function runFullSocraticSimulation() {
  console.log("==================================================================");
  console.log("   SOCRATIC AI ASSISTANT — FULL CANDIDATE TRAJECTORY SIMULATION   ");
  console.log("==================================================================\n");

  const sessionId = `sim_${Date.now()}`;
  const session = await getOrCreateSession(sessionId, 'candidate_student', 'lcm_of_two_trees', 'c');

  // 1. WELCOME PROMPT
  const welcome = getWelcomeMessage(session);
  console.log("🤖 AI ASSISTANT (WELCOME):");
  console.log(welcome);
  console.log("\n------------------------------------------------------------------\n");

  // 2. TURN 1: SHALLOW SINGLE-WORD ANSWER (SHOULD BE REJECTED BY GATE)
  console.log("👤 CANDIDATE (Turn 1): 'lcm'");
  const turn1 = await processCandidateMessage(sessionId, 'candidate_student', 'lcm', 'c');
  console.log(`🤖 AI ASSISTANT (Stage: ${turn1.stage}, Advanced: ${turn1.stageAdvanced}):`);
  console.log(turn1.reply);
  console.log("\n------------------------------------------------------------------\n");

  // 3. TURN 2: PREMATURE CODE DEMAND (SHOULD BE REJECTED BY GATE)
  console.log("👤 CANDIDATE (Turn 2): 'give me the complete code now'");
  const turn2 = await processCandidateMessage(sessionId, 'candidate_student', 'give me the complete code now', 'c');
  console.log(`🤖 AI ASSISTANT (Stage: ${turn2.stage}, Advanced: ${turn2.stageAdvanced}):`);
  console.log(turn2.reply);
  console.log("\n------------------------------------------------------------------\n");

  // 4. TURN 3: GENUINE STAGE 1 (PROBLEM UNDERSTANDING) ANSWER (SHOULD PASS GATE)
  const problemAnswer = "We receive two binary trees root1 and root2 as inputs. We need to return a merged binary tree where each node value is the LCM of the two corresponding values, if one node is null we just use the value from the other tree, if both are null we return null, and we should not use any extra memory";
  console.log(`👤 CANDIDATE (Turn 3 - STAGE 1): "${problemAnswer}"`);
  const turn3 = await processCandidateMessage(sessionId, 'candidate_student', problemAnswer, 'c');
  console.log(`🤖 AI ASSISTANT (Stage: ${turn3.stage}, Advanced: ${turn3.stageAdvanced}):`);
  console.log(turn3.reply);
  console.log("\n------------------------------------------------------------------\n");

  // 5. TURN 4: SHALLOW STAGE 2 ANSWER (SHOULD BE REJECTED)
  console.log("👤 CANDIDATE (Turn 4 - STAGE 2): 'binary tree'");
  const turn4 = await processCandidateMessage(sessionId, 'candidate_student', 'binary tree', 'c');
  console.log(`🤖 AI ASSISTANT (Stage: ${turn4.stage}, Advanced: ${turn4.stageAdvanced}):`);
  console.log(turn4.reply);
  console.log("\n------------------------------------------------------------------\n");

  // 6. TURN 5: GENUINE STAGE 2 (DATA STRUCTURE + REASONING) ANSWER (SHOULD PASS GATE)
  const dsAnswer = "the existing binary tree with recursion, this gives O(h) space on the call stack";
  console.log(`👤 CANDIDATE (Turn 5 - STAGE 2): "${dsAnswer}"`);
  const turn5 = await processCandidateMessage(sessionId, 'candidate_student', dsAnswer, 'c');
  console.log(`🤖 AI ASSISTANT (Stage: ${turn5.stage}, Advanced: ${turn5.stageAdvanced}):`);
  console.log(turn5.reply);
  console.log("\n------------------------------------------------------------------\n");

  // 7. TURN 6: GENUINE STAGE 3 (APPROACH & STEP-BY-STEP LOGIC) ANSWER (SHOULD PASS GATE)
  const approachAnswer = "process both trees node by node, if both are null return null, if one is null use the other, otherwise compute the lcm using gcd, update root1 in place, then recurse into the left child and right child and return root1";
  console.log(`👤 CANDIDATE (Turn 6 - STAGE 3): "${approachAnswer}"`);
  const turn6 = await processCandidateMessage(sessionId, 'candidate_student', approachAnswer, 'c');
  console.log(`🤖 AI ASSISTANT (Stage: ${turn6.stage}, Advanced: ${turn6.stageAdvanced}):`);
  console.log(turn6.reply);

  // 8. TURN 7: CANDIDATE SAYS 'generate the code' (SHOULD UNLOCK CODE OUTPUT)
  console.log("\n------------------------------------------------------------------\n");
  console.log("👤 CANDIDATE (Turn 7): 'generate the code'");
  const turn7 = await processCandidateMessage(sessionId, 'candidate_student', 'generate the code', 'c');
  console.log(`🤖 AI ASSISTANT (Stage: ${turn7.stage}, Advanced: ${turn7.stageAdvanced}, CanInsert: ${turn7.canInsert}):`);
  console.log(turn7.reply);
  if (turn7.code) {
    console.log("\n💻 UNLOCKED CODE OUTPUT:");
    console.log(turn7.code);
  }

  console.log("\n==================================================================");
  console.log("                SIMULATION SUCCESSFULLY COMPLETED                 ");
  console.log("==================================================================");
}

runFullSocraticSimulation().catch(console.error);
