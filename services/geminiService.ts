
import { GoogleGenAI } from "@google/genai";
import { AppData } from "../types.ts";

export const geminiService = {
  analyzeAttendance: async (data: AppData, query: string) => {
    // Create a new instance right before use to ensure the latest API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Providing a more detailed schema context to Gemini
    const context = `
      You are an expert HR Data Analyst. Here is a summary of the current workforce and attendance data:
      Total Employees: ${data.employees.length}
      Total Attendance Records: ${data.attendance.length}
      Total Shifts: ${data.shifts.length}
      
      Employee Schema: employeeNumber, fullName, email, dateOfJoining, jobTitle, businessUnit, department, subDepartment, location, costCenter, legalEntity, band, reportingTo, dottedLineManager, activeStatus, resignationDate, leftDate, contractId, excludeFromWorkhoursCalculation.
      
      Workforce Distribution Sample (First 3):
      ${JSON.stringify(data.employees.slice(0, 3))}
      
      Attendance Sample:
      ${JSON.stringify(data.attendance.slice(0, 5))}
    `;

    try {
      const response = await ai.models.generateContent({
        // Using gemini-3-pro-preview for complex reasoning tasks as per guidelines.
        model: 'gemini-3-pro-preview',
        contents: `${context}\n\nUser Question: ${query}\n\nAnalyze the data considering organizational hierarchies (Business Units, Bands, Cost Centers). Provide a professional HR report style response.`,
      });
      // Accessing text as a property, not a method.
      return response.text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "I encountered an error analyzing your complex organizational data. Please check your system logs.";
    }
  }
};