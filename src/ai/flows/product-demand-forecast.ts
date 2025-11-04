
'use server';
/**
 * @fileOverview An AI agent that provides a demand forecast for a specific product.
 *
 * - productDemandForecast - A function that handles the demand forecasting process.
 * - ProductDemandForecastInput - The input type for the productDemandForecast function.
 * - ProductDemandForecastOutput - The return type for the productDemandForecast function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProductSchema = z.object({
    name: z.string().describe("The name of the product."),
    category: z.string().describe("The category of the product."),
    currentStock: z.number().describe("The current stock level of the product."),
    sellingPrice: z.number().describe("The selling price for one unit of the product."),
    lifecycle: z.enum(["New", "Mature", "Declining"]).optional().describe("The product's current lifecycle stage."),
    leadTime: z.number().describe("The time in days for a new order of this product to arrive."),
    promotion: z.object({
        type: z.string(),
        startDate: z.string(),
        endDate: z.string(),
    }).optional().describe("Details of any active or upcoming promotion."),
});

const SaleSchema = z.object({
    saleDate: z.string().describe("The ISO 8601 date of the sale."),
    quantity: z.number().describe("The quantity sold."),
});

const ProductDemandForecastInputSchema = z.object({
  product: ProductSchema,
  salesHistory: z.array(SaleSchema).describe("The historical sales data for this product."),
  externalFactors: z.string().optional().describe('General external factors, like market trends or competitor actions.'),
  seasonalityEvents: z.string().optional().describe("A list of upcoming events that could influence demand, like holidays, festivals, or promotions."),
});
export type ProductDemandForecastInput = z.infer<typeof ProductDemandForecastInputSchema>;

const ForecastDataPointSchema = z.object({
    date: z.string().describe("The forecasted date in 'YYYY-MM-DD' format."),
    predictedUnits: z.number().describe("The predicted number of units to be sold on that date."),
});

const ProductDemandForecastOutputSchema = z.object({
  forecastData: z.array(ForecastDataPointSchema).describe("An array of daily forecasted sales data points for the lead time period."),
  totalForecastedUnits: z.number().describe("The total forecasted demand in units for the product over its lead time period."),
  forecastedRevenue: z.number().describe("The total forecasted revenue (total units * selling price)."),
  expectedGrowth: z.string().describe("The expected percentage growth or decline compared to the historical average (e.g., '+15%', '-5%')."),
  topFactor: z.string().describe("The single most important factor that influenced this forecast."),
  analysis: z.string().describe('A very short and concise (1-2 sentences) analysis explaining the reasoning behind the forecast.'),
});
export type ProductDemandForecastOutput = z.infer<typeof ProductDemandForecastOutputSchema>;

export async function productDemandForecast(input: ProductDemandForecastInput): Promise<ProductDemandForecastOutput> {
  return productDemandForecastFlow(input);
}

const prompt = ai.definePrompt({
  name: 'productDemandForecastPrompt',
  input: {schema: ProductDemandForecastInputSchema},
  output: {schema: ProductDemandForecastOutputSchema},
  prompt: `You are a demand forecasting expert for a retail business. Your task is to predict the daily demand for a specific product for its upcoming lead time period.

First, calculate the historical sales velocity from the provided sales history.
- If there are no sales, velocity is 0.
- Otherwise, find the earliest and latest sale date. The timespan is the difference in days (minimum 1 day).
- Velocity is total quantity sold / timespan.

Product Details:
- Name: {{{product.name}}}
- Category: {{{product.category}}}
- Current Stock: {{{product.currentStock}}} units
- Selling Price: {{{product.sellingPrice}}} per unit
- Lead Time: {{{product.leadTime}}} days
- Lifecycle Stage: {{{product.lifecycle}}}
- Active/Upcoming Promotion: {{{json product.promotion}}}

Sales History:
{{{json salesHistory}}}

Contextual Factors:
- External Market Factors: {{{externalFactors}}}
- Upcoming Events/Seasonality: {{{seasonalityEvents}}}

Based on ALL this data, perform the following steps:
1.  **Generate Daily Forecast**: Provide a daily numerical forecast for the total demand over the product's lead time of **{{{product.leadTime}}} days**. The output must be an array of daily forecast data points in the 'forecastData' field. The length of this array must be exactly equal to the product's lead time. Use the historical sales velocity you calculated as the baseline and adjust it based on other factors.
2.  **Calculate Total Units**: Sum the 'predictedUnits' from your daily forecast to get 'totalForecastedUnits'.
3.  **Calculate Forecasted Revenue**: Multiply 'totalForecastedUnits' by the product's 'sellingPrice'.
4.  **Calculate Expected Growth**: Compare the forecasted average daily sales with the provided historical sales velocity. Express this as a percentage string (e.g., "+15%", "-5%").
5.  **Identify Top Factor**: State the single most important factor that influenced your forecast (e.g., "Diwali promotion," "Recent sales spike," "Declining product lifecycle").
6.  **Provide Analysis**: Write a very concise analysis (1-2 sentences) explaining the key drivers of your forecast.

Consider the following in your analysis:
-   **Product Lifecycle**: A "New" product might see accelerating demand. A "Declining" product will likely see demand drop.
-   **Events & Seasonality**: How will the 'seasonalityEvents' or 'product.promotion' impact demand?
`,
});

const productDemandForecastFlow = ai.defineFlow(
  {
    name: 'productDemandForecastFlow',
    inputSchema: ProductDemandForecastInputSchema,
    outputSchema: ProductDemandForecastOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
