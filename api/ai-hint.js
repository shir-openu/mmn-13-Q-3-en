// api/ai-hint.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const MAX_ATTEMPTS = 10;

// Helper function to call OpenRouter API
async function callOpenRouter(prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Helper function to call Google Gemini API
async function callGemini(prompt) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export default async function handler(req, res) {
  // CORS headers - simple approach matching DF_7 for reliability
  res.setHeader('Access-Control-Allow-Origin', 'https://shir-openu.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userInput, currentStep, problemData, conversationHistory } = req.body;

  // Check attempt limit
  if (conversationHistory && conversationHistory.length >= MAX_ATTEMPTS) {
    return res.status(200).json({
      hint: `You have used all ${MAX_ATTEMPTS} attempts. Here is the full solution:\n\n` + problemData.fullSolution
    });
  }

  try {
    // Determine which AI provider to use
    const aiProvider = process.env.AI_PROVIDER || 'google';

    // Build conversation history text
    let conversationText = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(turn => {
        conversationText += `Student answer: ${turn.user}\nTeacher response: ${turn.ai}\n\n`;
      });
    }

const prompt = `
# CRITICAL INSTRUCTIONS
1. ALWAYS respond in ENGLISH. This is the English version of the exercise. Even if the student writes in another language, you MUST respond in English
2. Be PRACTICAL and SPECIFIC - give concrete mathematical guidance
3. Keep responses 2-4 sentences
4. Use gender-neutral language (plural forms)
5. NEVER give the complete final answer until ${MAX_ATTEMPTS} attempts exhausted
6. NEVER repeat the same hint - check conversation history and progress
7. NEVER put quotes around equations - write them directly without '' or "" marks
8. ACCEPT ANY MATHEMATICALLY EQUIVALENT FORM of the correct answer

---

# The Exercise: 3×3 Non-Homogeneous ODE System with Double Eigenvalue

## The Problem:
x' = Ax + b

A = [4, -1, -1; 1, 5, 2; 0, 1, 5]
b = e^{3t}[1, 1, 0]^T

Find the general solution.

## COMPLETE SOLUTIONS (your reference):

**Step 1 - Find Eigenvalues:**
- Characteristic polynomial: |λI - A| = (λ-4)²(λ-6)
- ANSWER: λ₁ = 6 (simple), λ₂ = 4 (double, multiplicity 2)

**Step 2 - Eigenvector for λ = 6:**
- (6I - A)v = 0
- Row reduce [2, 1, 1; -1, 1, -2; 0, -1, 1]
- ANSWER: v₁ = [-1, 1, 1]^T

**Step 3 - Eigenvector for λ = 4:**
- (4I - A)v = 0
- Row reduce [0, 1, 1; -1, -1, -2; 0, -1, -1]
- Geometric multiplicity = 1 (only one eigenvector)
- ANSWER: v₂ = [1, 1, -1]^T

**Step 4 - Generalized Eigenvector (Third Solution):**
- Since λ=4 has algebraic multiplicity 2 but geometric multiplicity 1, need generalized eigenvector
- Solve (A - 4I)w = v₂
- w₁ is free, choose w₁ = 0: w₂ = -3, w₃ = 2
- ANSWER: w = [0, -3, 2]^T
- Third solution: x₃(t) = te^{4t}v₂ + e^{4t}w = e^{4t}[t, t-3, 2-t]^T

**Step 5 - Particular Solution:**
- Since 3 is NOT an eigenvalue, try x_p = e^{3t}[a₁, a₂, a₃]^T
- Solve (3I - A)[a₁, a₂, a₃]^T = [1, 1, 0]^T
- ANSWER: a₁ = -1, a₂ = 0, a₃ = 0
- x_p(t) = e^{3t}[-1, 0, 0]^T

**General Solution:**
x(t) = -C₁e^{6t} + C₂e^{4t} + C₃te^{4t} - e^{3t}
y(t) = C₁e^{6t} + C₂e^{4t} + C₃(t-3)e^{4t}
z(t) = C₁e^{6t} - C₂e^{4t} + C₃(2-t)e^{4t}

---

## Current Step: ${currentStep}
## Expected Answer: ${problemData.correctAnswer}
## Student Input: ${userInput}

${conversationText ? `## Previous Conversation:\n${conversationText}` : ''}

---

# SPECIFIC HINTS BY STEP (give progressively):

## If Step 1 (eigenvalues):
- Hint 1: "Compute the characteristic polynomial |λI - A| = 0. This is a 3×3 matrix."
- Hint 2: "Expand the determinant along a row or column. Try expanding along the first column."
- Hint 3: "The characteristic polynomial is (λ-4)²(λ-6)."
- Hint 4: "λ₁ = 6 (simple eigenvalue), λ₂ = 4 (double eigenvalue)."

## If Step 2 (eigenvector for λ=6):
- Hint 1: "Substitute λ = 6 into (λI - A) and solve (6I - A)v = 0."
- Hint 2: "The matrix is [2, 1, 1; -1, 1, -2; 0, -1, 1]. Row reduce it."
- Hint 3: "After row reduction: v₃ = t (free), v₂ = t, v₁ = -t."
- Hint 4: "The eigenvector is v₁ = [-1, 1, 1]^T."

## If Step 3 (eigenvector for λ=4):
- Hint 1: "Substitute λ = 4 into (λI - A) and solve (4I - A)v = 0."
- Hint 2: "The matrix is [0, 1, 1; -1, -1, -2; 0, -1, -1]. Row reduce it."
- Hint 3: "Note that the geometric multiplicity is 1 - there is only one eigenvector!"
- Hint 4: "The eigenvector is v₂ = [1, 1, -1]^T."

## If Step 4 (generalized eigenvector):
- Hint 1: "Since the double eigenvalue λ=4 has only one eigenvector, we need a generalized eigenvector w."
- Hint 2: "Solve the system (A - 4I)w = v₂, i.e. [0,-1,-1; 1,1,2; 0,1,1]w = [1,1,-1]^T."
- Hint 3: "w₁ is a free parameter. Choose w₁ = 0 and find w₂ and w₃."
- Hint 4: "w₂ = -3, w₃ = 2. The generalized eigenvector is w = [0, -3, 2]^T."

## If Step 5 (particular solution):
- Hint 1: "Since 3 is not an eigenvalue, try a particular solution x_p = e^{3t}[a₁, a₂, a₃]^T."
- Hint 2: "Substitute into the system and cancel e^{3t}. You get (3I - A)a = [1, 1, 0]^T."
- Hint 3: "The matrix (3I - A) = [-1, 1, 1; -1, -2, -2; 0, -1, -2]. Solve the system."
- Hint 4: "a₁ = -1, a₂ = 0, a₃ = 0. The particular solution is x_p = e^{3t}[-1, 0, 0]^T."

# COMMON ERRORS TO CHECK:
- Wrong determinant calculation for 3×3 matrix
- Confusing simple and double eigenvalue
- Not recognizing that geometric multiplicity < algebraic multiplicity
- Wrong sign in (A - 4I) vs (4I - A)
- Forgetting that 3 is not an eigenvalue (so simple ansatz works)
- Sign errors in the particular solution system

# YOUR RESPONSE:
1. If CORRECT: "Correct! [brief confirmation]" and encourage next step
2. If INCORRECT: Identify the specific error and give the appropriate hint from above
3. If student asks for help/hint: Give the next hint in progression
4. After 3+ attempts: Give more explicit guidance, show intermediate steps
`;

    // Call the appropriate AI provider
    let hint;
    if (aiProvider === 'openrouter') {
      hint = await callOpenRouter(prompt);
    } else {
      // Default to Google Gemini
      hint = await callGemini(prompt);
    }

    return res.status(200).json({ hint, provider: aiProvider });

  } catch (error) {
    console.error('AI API Error:', error);
    const aiProvider = process.env.AI_PROVIDER || 'google';
    return res.status(500).json({
      error: 'Error processing the request. Please try again.',
      provider: aiProvider,
      details: error.message
    });
  }
}
