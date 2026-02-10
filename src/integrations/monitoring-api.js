import axios from 'axios';

export async function pingServer(serverUrl) {
  try {
    const startTime = Date.now();
    await axios.get(serverUrl, { timeout: 5000 });
    const responseTime = Date.now() - startTime;

    return {
      success: true,
      responseTime,
      message: `Server is online (${responseTime}ms)`
    };
  } catch (error) {
    return {
      success: false,
      responseTime: null,
      message: error.code === 'ECONNABORTED' ? 'Request timeout' : error.message
    };
  }
}

export async function checkAPI(apiUrl) {
  try {
    const startTime = Date.now();
    const response = await axios.get(apiUrl, { timeout: 10000 });
    const responseTime = Date.now() - startTime;

    return {
      success: true,
      status: response.status,
      responseTime,
      data: response.data,
      message: `API is responding (${responseTime}ms)`
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || null,
      responseTime: null,
      data: null,
      message: error.message
    };
  }
}

export async function checkService(serviceName, serverUrl) {
  try {
    // This is a generic implementation. In production, you would implement
    // specific checks for different service types (e.g., database, cache, etc.)
    const healthEndpoint = `${serverUrl}/health/${serviceName}`;
    const response = await axios.get(healthEndpoint, { timeout: 5000 });

    return {
      success: response.data.status === 'running' || response.data.healthy === true,
      message: `Service ${serviceName} is ${response.data.status || 'running'}`,
      details: response.data
    };
  } catch (error) {
    // If there's no health endpoint, fall back to checking server availability
    const serverCheck = await pingServer(serverUrl);

    return {
      success: serverCheck.success,
      message: serverCheck.success
        ? `Server is online but no specific health check for ${serviceName}`
        : `Cannot reach server for ${serviceName}`,
      details: {
        serverAvailable: serverCheck.success,
        error: error.message
      }
    };
  }
}
