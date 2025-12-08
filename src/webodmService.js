// src/webodmService.js
/**
 * WebODM API Service
 * Handles drone image processing via WebODM/OpenDroneMap
 */

const WEBODM_URL = import.meta.env.VITE_WEBODM_URL || "http://localhost:8080";
const WEBODM_TOKEN = import.meta.env.VITE_WEBODM_TOKEN || "";

/**
 * Get authentication headers
 */
const getHeaders = (includeAuth = true) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (includeAuth && WEBODM_TOKEN) {
    headers["Authorization"] = `JWT ${WEBODM_TOKEN}`;
  }

  return headers;
};

/**
 * Login to WebODM and get a token
 */
export const login = async (username = "admin", password = "admin") => {
  const response = await fetch(`${WEBODM_URL}/api/token-auth/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error("Login failed");
  }

  const data = await response.json();
  return data.token;
};

/**
 * Check if WebODM is running and accessible
 */
export const checkHealth = async () => {
  try {
    const response = await fetch(`${WEBODM_URL}/api/`, {
      method: "GET",
      headers: getHeaders(false),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Get all projects
 */
export const getProjects = async (token) => {
  const response = await fetch(`${WEBODM_URL}/api/projects/`, {
    headers: {
      Authorization: `JWT ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get projects");
  }

  return response.json();
};

/**
 * Create a new project
 */
export const createProject = async (token, name, description = "") => {
  const response = await fetch(`${WEBODM_URL}/api/projects/`, {
    method: "POST",
    headers: {
      Authorization: `JWT ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    throw new Error("Failed to create project");
  }

  return response.json();
};

/**
 * Get or create a project for a farm
 */
export const getOrCreateFarmProject = async (token, farmId, farmName) => {
  const projects = await getProjects(token);

  // Look for existing project with farm ID in description
  const existing = projects.find(
    (p) =>
      p.description?.includes(`farm:${farmId}`) ||
      p.name === `Farm: ${farmName}`
  );

  if (existing) {
    return existing;
  }

  // Create new project
  return createProject(token, `Farm: ${farmName}`, `farm:${farmId}`);
};

/**
 * Create a processing task with images
 * @param {string} token - JWT token
 * @param {number} projectId - Project ID
 * @param {File[]} images - Array of image files
 * @param {object} options - Processing options
 */
export const createTask = async (token, projectId, images, options = {}) => {
  const formData = new FormData();

  // Add images
  images.forEach((image, index) => {
    formData.append("images", image, image.name);
  });

  // Processing options for vegetation analysis
  const processingOptions = {
    dsm: true, // Generate surface model
    "orthophoto-resolution": 2, // 2cm/pixel
    "auto-boundary": true, // Auto-detect boundary
    "use-3dmesh": false, // Skip 3D mesh (faster)
    "skip-3dmodel": true, // Skip 3D model (faster)
    "pc-quality": "medium", // Point cloud quality
    "feature-quality": "medium", // Feature extraction quality
    ...options,
  };

  // Add options as JSON
  formData.append(
    "options",
    JSON.stringify(
      Object.entries(processingOptions).map(([name, value]) => ({
        name,
        value,
      }))
    )
  );

  // Optional: Add task name
  if (options.name) {
    formData.append("name", options.name);
  }

  const response = await fetch(
    `${WEBODM_URL}/api/projects/${projectId}/tasks/`,
    {
      method: "POST",
      headers: {
        Authorization: `JWT ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create task: ${error}`);
  }

  return response.json();
};

/**
 * Get task status
 */
export const getTaskStatus = async (token, projectId, taskId) => {
  const response = await fetch(
    `${WEBODM_URL}/api/projects/${projectId}/tasks/${taskId}/`,
    {
      headers: {
        Authorization: `JWT ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get task status");
  }

  return response.json();
};

/**
 * Task status codes
 */
export const TASK_STATUS = {
  QUEUED: 10,
  RUNNING: 20,
  FAILED: 30,
  COMPLETED: 40,
  CANCELED: 50,
};

export const getStatusLabel = (status) => {
  switch (status) {
    case TASK_STATUS.QUEUED:
      return "Queued";
    case TASK_STATUS.RUNNING:
      return "Processing";
    case TASK_STATUS.FAILED:
      return "Failed";
    case TASK_STATUS.COMPLETED:
      return "Completed";
    case TASK_STATUS.CANCELED:
      return "Canceled";
    default:
      return "Unknown";
  }
};

/**
 * Get task output files
 */
export const getTaskAssets = async (token, projectId, taskId) => {
  const response = await fetch(
    `${WEBODM_URL}/api/projects/${projectId}/tasks/${taskId}/assets/`,
    {
      headers: {
        Authorization: `JWT ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get task assets");
  }

  return response.json();
};

/**
 * Get download URL for a specific asset
 */
export const getAssetDownloadUrl = (projectId, taskId, assetPath) => {
  return `${WEBODM_URL}/api/projects/${projectId}/tasks/${taskId}/download/${assetPath}`;
};

/**
 * Download orthophoto (main output)
 */
export const downloadOrthophoto = async (token, projectId, taskId) => {
  const url = getAssetDownloadUrl(projectId, taskId, "orthophoto.tif");

  const response = await fetch(url, {
    headers: {
      Authorization: `JWT ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to download orthophoto");
  }

  return response.blob();
};

/**
 * Get orthophoto tile URL for viewing
 */
export const getOrthophotoTileUrl = (projectId, taskId) => {
  return `${WEBODM_URL}/api/projects/${projectId}/tasks/${taskId}/tiles/{z}/{x}/{y}.png`;
};

/**
 * Cancel a running task
 */
export const cancelTask = async (token, projectId, taskId) => {
  const response = await fetch(
    `${WEBODM_URL}/api/projects/${projectId}/tasks/${taskId}/cancel/`,
    {
      method: "POST",
      headers: {
        Authorization: `JWT ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to cancel task");
  }

  return response.json();
};

/**
 * Restart a failed task
 */
export const restartTask = async (token, projectId, taskId) => {
  const response = await fetch(
    `${WEBODM_URL}/api/projects/${projectId}/tasks/${taskId}/restart/`,
    {
      method: "POST",
      headers: {
        Authorization: `JWT ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to restart task");
  }

  return response.json();
};

/**
 * Delete a task
 */
export const deleteTask = async (token, projectId, taskId) => {
  const response = await fetch(
    `${WEBODM_URL}/api/projects/${projectId}/tasks/${taskId}/`,
    {
      method: "DELETE",
      headers: {
        Authorization: `JWT ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete task");
  }

  return true;
};

/**
 * Poll task status until completion
 * @param {string} token - JWT token
 * @param {number} projectId - Project ID
 * @param {string} taskId - Task ID
 * @param {function} onProgress - Callback for progress updates
 * @param {number} interval - Polling interval in ms
 */
export const pollTaskStatus = async (
  token,
  projectId,
  taskId,
  onProgress = () => {},
  interval = 5000
) => {
  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const task = await getTaskStatus(token, projectId, taskId);

        onProgress({
          status: task.status,
          statusLabel: getStatusLabel(task.status),
          progress: task.running_progress || 0,
          processingTime: task.processing_time,
          imagesCount: task.images_count,
        });

        if (task.status === TASK_STATUS.COMPLETED) {
          resolve(task);
        } else if (task.status === TASK_STATUS.FAILED) {
          reject(new Error(task.last_error || "Processing failed"));
        } else if (task.status === TASK_STATUS.CANCELED) {
          reject(new Error("Task was canceled"));
        } else {
          // Still processing, check again
          setTimeout(checkStatus, interval);
        }
      } catch (error) {
        reject(error);
      }
    };

    checkStatus();
  });
};

/**
 * Full processing workflow:
 * 1. Create/get project
 * 2. Upload images and create task
 * 3. Poll until complete
 * 4. Download orthophoto
 */
export const processImages = async ({
  token,
  farmId,
  farmName,
  images,
  options = {},
  onProgress = () => {},
}) => {
  // Step 1: Get or create project
  onProgress({ step: "project", message: "Setting up project..." });
  const project = await getOrCreateFarmProject(token, farmId, farmName);

  // Step 2: Create task with images
  onProgress({ step: "upload", message: "Uploading images..." });
  const task = await createTask(token, project.id, images, {
    name: `Flight ${new Date().toISOString().split("T")[0]}`,
    ...options,
  });

  // Step 3: Poll for completion
  onProgress({ step: "processing", message: "Processing images..." });
  const completedTask = await pollTaskStatus(
    token,
    project.id,
    task.id,
    (progress) => {
      onProgress({
        step: "processing",
        message: `${progress.statusLabel} - ${Math.round(progress.progress)}%`,
        progress: progress.progress,
      });
    }
  );

  // Step 4: Get output info
  onProgress({ step: "complete", message: "Processing complete!" });

  return {
    projectId: project.id,
    taskId: completedTask.id,
    orthophotoUrl: getAssetDownloadUrl(
      project.id,
      completedTask.id,
      "orthophoto.tif"
    ),
    tileUrl: getOrthophotoTileUrl(project.id, completedTask.id),
    processingTime: completedTask.processing_time,
  };
};
