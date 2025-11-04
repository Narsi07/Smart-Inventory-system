'use server';
/**
 * @fileOverview An AI agent that provides a financial analysis of the inventory.
 *
 * - financialAnalysis - A function that generates a financial analysis.
 * - FinancialAnalysisInput - The input type for the financialAnalysis function.
 * - FinancialAnalysisOutput - The return type for the financialAnalysis function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const FinancialAnalysisInputSchema = z.object({
    totalInventoryValue: z.number(),
    potentialProfit: z.number(),
    averageMargin: z.number(),
    highestMarginProducts: z.array(z.object({ name: z.string(), margin: z.number() })),
});
export type FinancialAnalysisInput = z.infer<typeof FinancialAnalysisInputSchema>;

const FinancialAnalysisOutputSchema = z.object({
  analysis: z.string().describe('A concise, insightful financial analysis of the inventory in 2-3 short sentences. Use markdown for formatting like bolding.'),
});
export type FinancialAnalysisOutput = z.infer<typeof FinancialAnalysisOutputSchema>;

export async function financialAnalysis(input: FinancialAnalysisInput): Promise<FinancialAnalysisOutput> {
  return financialAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'financialAnalysisPrompt',
  input: {schema: FinancialAnalysisInputSchema},
  output: {schema: FinancialAnalysisOutputSchema},
  prompt: `You are an expert financial analyst. Your task is to provide a brief analysis of the inventory's financial health based on the data provided.

Current Financials:
- Total Inventory Value (Cost): {{{totalInventoryValue}}}
- Potential Profit: {{{potentialProfit}}}
- Average Profit Margin: {{{averageMargin}}}%
- Top 5 Highest Margin Products: {{{json highestMarginProducts}}}

Analyze the data and generate a 2-3 sentence summary. Focus on actionable insights. For example:
- Comment on the overall health based on the inventory value and potential profit.
- Point out if the average margin is healthy or needs improvement.
- Highlight the importance of the highest margin products.

Keep the tone professional and strategic. Use markdown for formatting like bolding.
`,
});

const financialAnalysisFlow = ai.defineFlow(
  {
    name: 'financialAnalysisFlow',
    inputSchema: FinancialAnalysisInputSchema,
    outputSchema: FinancialAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
