'use server';

/**
 * @fileOverview A demand forecasting AI agent.
 *
 * - demandForecastingDashboard - A function that handles the demand forecasting process.
 * - DemandForecastingDashboardInput - The input type for the demandForecastingDashboard function.
 * - DemandForecastingDashboardOutput - The return type for the demandForecastingDashboard function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DemandForecastingDashboardInputSchema = z.object({
  historicalData: z
    .string()
    .describe(
      'Historical data of product sales, including date, product ID, and quantity sold.'
    ),
  seasonality: z.string().describe('Seasonality trends affecting demand.'),
  externalFactors: z.string().describe('External factors influencing demand, such as promotions or economic indicators.'),
});
export type DemandForecastingDashboardInput = z.infer<
  typeof DemandForecastingDashboardInputSchema
>;

const DemandForecastingDashboardOutputSchema = z.object({
  forecastedDemand: z
    .string()
    .describe('Forecasted demand for the next period.'),
  factorsUsed: z
    .string()
    .describe(
      'Details about the factors used for demand forecasting, including historical data, seasonality, and external factors.'
    ),
});
export type DemandForecastingDashboardOutput = z.infer<
  typeof DemandForecastingDashboardOutputSchema
>;

export async function demandForecastingDashboard(
  input: DemandForecastingDashboardInput
): Promise<DemandForecastingDashboardOutput> {
  return demandForecastingDashboardFlow(input);
}

const prompt = ai.definePrompt({
  name: 'demandForecastingDashboardPrompt',
  input: {schema: DemandForecastingDashboardInputSchema},
  output: {schema: DemandForecastingDashboardOutputSchema},
  prompt: `You are an expert in demand forecasting, providing accurate predictions based on various factors.

  Analyze the following information to forecast future demand and explain the factors influencing your forecast.

  Historical Data: {{{historicalData}}}
  Seasonality: {{{seasonality}}}
  External Factors: {{{externalFactors}}}

  Provide a forecasted demand for the next period and detail the factors used in your forecast.
  `,
});

const demandForecastingDashboardFlow = ai.defineFlow(
  {
    name: 'demandForecastingDashboardFlow',
    inputSchema: DemandForecastingDashboardInputSchema,
    outputSchema: DemandForecastingDashboardOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
