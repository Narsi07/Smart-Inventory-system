'use server';
/**
 * @fileOverview An AI agent that generates product details based on a name.
 *
 * - generateProductDetails - A function that suggests a category and description.
 * - GenerateProductDetailsInput - The input type for the generateProductDetails function.
 * - GenerateProductDetailsOutput - The return type for the generateProductDetails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateProductDetailsInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
});
export type GenerateProductDetailsInput = z.infer<typeof GenerateProductDetailsInputSchema>;

const GenerateProductDetailsOutputSchema = z.object({
  category: z.string().describe('A suitable category for the product.'),
  description: z.string().describe('A concise and appealing product description (2-3 sentences).'),
});
export type GenerateProductDetailsOutput = z.infer<typeof GenerateProductDetailsOutputSchema>;

export async function generateProductDetails(input: GenerateProductDetailsInput): Promise<GenerateProductDetailsOutput> {
    return generateProductDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProductDetailsPrompt',
  input: { schema: GenerateProductDetailsInputSchema },
  output: { schema: GenerateProductDetailsOutputSchema },
  prompt: `You are an expert product manager. Given a product name, suggest a suitable category and write a compelling but brief product description.

Product Name: {{{productName}}}

Categories should be general (e.g., "Electronics", "Pantry Staples", "Fresh Produce", "Apparel").
The description should be 2-3 sentences long, highlighting key features or benefits.
`,
});

const generateProductDetailsFlow = ai.defineFlow(
  {
    name: 'generateProductDetailsFlow',
    inputSchema: GenerateProductDetailsInputSchema,
    outputSchema: GenerateProductDetailsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
