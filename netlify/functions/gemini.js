const axios = require('axios');

exports.handler = async (event) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const { prompt } = JSON.parse(event.body || '{}');

  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        params: { key: apiKey },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
