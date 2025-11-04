
'use server';
/**
 * @fileOverview An AI agent that provides a summary of the inventory dashboard.
 *
 * - dashboardSummary - A function that generates a summary of the inventory dashboard.
 * - DashboardSummaryInput - The input type for the dashboardSummary function.
 * - DashboardSummaryOutput - The return type for the dashboardSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { Product } from '@/types';

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  stock: z.number(),
  reorderPoint: z.number(),
  salesVelocity: z.number(),
  costPrice: z.number(),
  sellingPrice: z.number(),
});

const DashboardSummaryInputSchema = z.object({
  products: z.array(ProductSchema).describe("List of all products in the inventory."),
  totalProducts: z.number(),
  lowStockCount: z.number(),
  outOfStockCount: z.number(),
});
export type DashboardSummaryInput = z.infer<typeof DashboardSummaryInputSchema>;

const DashboardSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise, insightful summary of the inventory status in 2-3 short sentences. Use markdown for bolding key terms.'),
});
export type DashboardSummaryOutput = z.infer<typeof DashboardSummaryOutputSchema>;

export async function dashboardSummary(input: DashboardSummaryInput): Promise<DashboardSummaryOutput> {
  return dashboardSummaryFlow(input);
}


const prompt = ai.definePrompt({
  name: 'dashboardSummaryPrompt',
  input: {schema: DashboardSummaryInputSchema},
  output: {schema: DashboardSummaryOutputSchema},
  prompt: `You are an expert inventory analyst. Your task is to provide a brief, actionable summary of the current inventory status based on the data provided.

Current State:
- Total Products: {{{totalProducts}}}
- Low Stock Items: {{{lowStockCount}}}
- Out of Stock Items: {{{outOfStockCount}}}

Product List:
{{{json products}}}

Analyze the data and generate a 2-3 sentence summary. Focus on the most critical information. For example:
- Highlight the number of out-of-stock items if it's greater than zero.
- Mention the number of low-stock items.
- Point out the highest-selling product if its sales velocity is significant.
- Identify the product with the highest total value (stock * costPrice) if it represents a large portion of the inventory value.

Keep the tone professional and direct. Use markdown for bolding. For example: "**Organic Bananas** are your top-selling item."
`,
});

const dashboardSummaryFlow = ai.defineFlow(
  {
    name: 'dashboardSummaryFlow',
    inputSchema: DashboardSummaryInputSchema,
    outputSchema: DashboardSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
