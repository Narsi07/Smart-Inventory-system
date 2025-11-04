
'use server';
/**
 * @fileOverview An AI agent that provides intelligent reorder suggestions based on demand forecasts and current stock levels.
 *
 * - intelligentReorderSuggestions - A function that handles the reorder suggestion process.
 * - IntelligentReorderSuggestionsInput - The input type for the intelligentReorderSuggestions function.
 * - IntelligentReorderSuggestionsOutput - The return type for the intelligentReorderSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProductReorderInfoSchema = z.object({
  productId: z.string().describe('The ID of the product to reorder.'),
  currentStockLevel: z.number().describe('The current stock level of the product.'),
  demandForecast: z.number().describe('The forecasted demand for the product over the next period.'),
  reorderPoint: z.number().describe('The reorder point for the product.'),
  reorderQuantity: z.number().describe('The standard reorder quantity for the product.'),
  leadTime: z.number().describe('The lead time in days to receive a new shipment of the product.'),
  salesVelocity: z.number().describe('The average number of units sold per day.'),
  salesVelocityTrend: z.number().describe("A number between -1 and 1 indicating the recent sales trend. > 0 is accelerating, < 0 is decelerating, 0 is stable."),
  supplierReliability: z.number().min(0).max(1).optional().describe("A score from 0 (very unreliable) to 1 (very reliable) for the supplier's on-time delivery."),
  storageCapacity: z.number().optional().describe("The maximum number of units that can be stored for this product."),
});

const IntelligentReorderSuggestionsInputSchema = z.object({
    products: z.array(ProductReorderInfoSchema),
});
export type IntelligentReorderSuggestionsInput = z.infer<typeof IntelligentReorderSuggestionsInputSchema>;


const ReorderSuggestionSchema = z.object({
  productId: z.string(),
  reorderSuggestion: z.boolean().describe('Whether a reorder is suggested.'),
  reorderQuantity: z.number().describe('The suggested reorder quantity.'),
  reasoning: z.string().describe('The reasoning behind the reorder suggestion, including key drivers.'),
});

const IntelligentReorderSuggestionsOutputSchema = z.object({
    suggestions: z.array(ReorderSuggestionSchema),
});
export type IntelligentReorderSuggestionsOutput = z.infer<typeof IntelligentReorderSuggestionsOutputSchema>;

export async function intelligentReorderSuggestions(input: IntelligentReorderSuggestionsInput): Promise<IntelligentReorderSuggestionsOutput> {
  return intelligentReorderSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'intelligentReorderSuggestionsPrompt',
  input: {schema: IntelligentReorderSuggestionsInputSchema},
  output: {schema: IntelligentReorderSuggestionsOutputSchema},
  prompt: `You are an expert supply chain analyst. For each product in the provided list, determine whether a reorder is suggested and what the optimal reorder quantity should be.

Analyze each product based on its current stock level, sales velocity, demand forecast, and other contextual data.

Product Data:
{{{json products}}}

For each product, consider the following factors:
- **Safety Stock**: The buffer to prevent stockouts. Adjust this based on supplier reliability. A lower reliability (e.g., < 0.8) requires a larger safety buffer. A good heuristic is (Avg Daily Sales * Lead Time * (1.5 - supplierReliability)).
- **Stock Depletion**: At the current sales velocity, how long will the stock last? Is it less than the lead time?
- **Sales Trend**: If sales velocity is accelerating (trend > 0.1), consider being more aggressive with the reorder. If it's decelerating, be more conservative.
- **Reorder Trigger**: Is the current stock level at or below the reorder point? This is a primary trigger.
- **Dynamic Reorder Quantity**: The standard reorder quantity is a baseline. Suggest a more intelligent quantity. A good starting point is to cover the forecasted demand for the lead time period plus the calculated safety buffer, minus what's already in stock. Adjust this based on the sales trend.
- **Storage Constraints**: The final suggested reorder quantity must NOT exceed the available storage capacity (Storage Capacity - Current Stock Level). If the ideal quantity is too large, cap it at the available space and mention this constraint in your reasoning.

Provide a clear reasoning for each reorder suggestion, including the key drivers that influenced your decision. Be concise but justify your numbers.

Return a list of suggestions, one for each product provided in the input.
`,
});

const intelligentReorderSuggestionsFlow = ai.defineFlow(
  {
    name: 'intelligentReorderSuggestionsFlow',
    inputSchema: IntelligentReorderSuggestionsInputSchema,
    outputSchema: IntelligentReorderSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

    