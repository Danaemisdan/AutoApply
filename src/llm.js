const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'deepseek/deepseek-r1-0528:free';

if (!OPENROUTER_API_KEY) {
  throw new Error('Missing OpenRouter API key. Please check your environment variables.');
}

class LLMService {
  constructor() {
    this.apiKey = OPENROUTER_API_KEY;
    this.model = AI_MODEL;
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }
#myass 
  /**
   * Generate cover letter based on resume and job description
   */
  async generateCoverLetter(resumeText, jobDescription, userPreferences = '') {
    try {
      const prompt = this.buildCoverLetterPrompt(resumeText, jobDescription, userPreferences);
      
      const response = await this.callOpenRouterAPI(prompt, {
        max_tokens: 1000,
        temperature: 0.7
      });

      return this.cleanResponse(response);
    } catch (error) {
      console.error('Error generating cover letter:', error);
      throw new Error('Failed to generate cover letter. Please try again later.');
    }
  }

  /**
   * Generate job suggestions based on user preferences
   */
  async generateJobSuggestions(userPreferences, resumeText = '') {
    try {
      const prompt = this.buildJobSuggestionsPrompt(userPreferences, resumeText);
      
      const response = await this.callOpenRouterAPI(prompt, {
        max_tokens: 800,
        temperature: 0.5
      });

      return this.cleanResponse(response);
    } catch (error) {
      console.error('Error generating job suggestions:', error);
      // Return mock data as fallback
      return this.getMockJobSuggestions(userPreferences);
    }
  }

  /**
   * Generate AI response for general queries
   */
  async generateResponse(message, context = '') {
    try {
      const prompt = this.buildGeneralPrompt(message, context);
      
      const response = await this.callOpenRouterAPI(prompt, {
        max_tokens: 500,
        temperature: 0.6
      });

      return this.cleanResponse(response);
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Sorry, I\'m having trouble processing your request. Please try again.');
    }
  }

  /**
   * Call OpenRouter API with retry logic
   */
  async callOpenRouterAPI(prompt, options = {}) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://telegram-job-bot.com',
            'X-Title': 'Telegram Job Bot'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: 'You are a professional job application assistant. Provide helpful, accurate, and professional responses.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: options.max_tokens || 500,
            temperature: options.temperature || 0.6,
            top_p: 0.9,
            frequency_penalty: 0.1,
            presence_penalty: 0.1
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('Invalid response format from API');
        }

        return data.choices[0].message.content;

      } catch (error) {
        lastError = error;
        console.error(`API call attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  /**
   * Build cover letter prompt
   */
  buildCoverLetterPrompt(resumeText, jobDescription, userPreferences = '') {
    return `Please write a professional cover letter based on the following information:

RESUME:
${resumeText.substring(0, 2000)}${resumeText.length > 2000 ? '...' : ''}

JOB DESCRIPTION:
${jobDescription}

USER PREFERENCES:
${userPreferences || 'No specific preferences mentioned'}

INSTRUCTIONS:
- Write a compelling, professional cover letter
- Highlight relevant skills and experiences from the resume
- Address the specific job requirements
- Keep it concise but comprehensive (300-500 words)
- Use a professional tone
- Include a clear opening, body, and closing
- Don't include generic phrases like "I am writing to apply"
- Make it specific to this role and company

Please format the response as a clean cover letter without any additional formatting or explanations.`;
  }

  /**
   * Build job suggestions prompt
   */
  buildJobSuggestionsPrompt(userPreferences, resumeText = '') {
    return `Based on the following information, suggest 3-5 relevant job opportunities:

USER PREFERENCES:
${userPreferences}

RESUME SUMMARY:
${resumeText ? resumeText.substring(0, 1000) + '...' : 'No resume provided'}

INSTRUCTIONS:
- Suggest 3-5 relevant job positions
- Include job title, company name, and brief description
- Focus on roles that match the user's preferences and background
- Provide realistic and current job opportunities
- Format as a numbered list with clear job titles and companies

Please provide the suggestions in a clean, numbered list format.`;
  }

  /**
   * Build general prompt for other queries
   */
  buildGeneralPrompt(message, context = '') {
    return `You are a helpful job application assistant. Please respond to the following query:

USER MESSAGE: ${message}

CONTEXT: ${context}

Please provide a helpful, professional response that assists with job applications, resume writing, or career advice.`;
  }

  /**
   * Clean and format API response
   */
  cleanResponse(response) {
    if (!response) return '';
    
    return response
      .trim()
      .replace(/^```\w*\n?/g, '') // Remove markdown code blocks
      .replace(/```$/g, '')
      .trim();
  }

  /**
   * Mock job suggestions as fallback
   */
  getMockJobSuggestions(preferences = '') {
    const preferencesLower = preferences.toLowerCase();
    
    const mockJobs = [
      {
        title: 'Software Engineer',
        company: 'TechCorp Inc.',
        description: 'Full-stack development role working with modern technologies like React, Node.js, and cloud platforms.'
      },
      {
        title: 'Data Scientist',
        company: 'Analytics Solutions',
        description: 'Machine learning and data analysis position focusing on predictive modeling and business intelligence.'
      },
      {
        title: 'Product Manager',
        company: 'Innovation Labs',
        description: 'Product strategy and development role leading cross-functional teams to deliver customer-focused solutions.'
      },
      {
        title: 'DevOps Engineer',
        company: 'Cloud Systems',
        description: 'Infrastructure automation and cloud deployment role using Docker, Kubernetes, and AWS/Azure.'
      },
      {
        title: 'UX Designer',
        company: 'Digital Experience Co.',
        description: 'User experience design role creating intuitive interfaces and improving user journeys.'
      }
    ];

    // Filter based on preferences if provided
    if (preferences) {
      const filteredJobs = mockJobs.filter(job => 
        job.title.toLowerCase().includes(preferencesLower) ||
        job.description.toLowerCase().includes(preferencesLower)
      );
      
      if (filteredJobs.length > 0) {
        return filteredJobs.slice(0, 3);
      }
    }

    return mockJobs.slice(0, 3);
  }
}

module.exports = new LLMService(); 