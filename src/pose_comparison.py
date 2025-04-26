import numpy as np

def l2_norm(a, b):
    return np.linalg.norm(a - b)

def compare_keypoints(ground_points, webcam_points):
    '''
    Compare pose landmarks: {'0': [x, y, z], '1': [x, y, z], ...}
    Only using x, y coordinates.
    '''
    ground_points_array = []
    webcam_points_array = []

    for i in range(len(ground_points)):
        ground_points_array.append(np.array(ground_points[str(i)])[0:2])
        webcam_points_array.append(np.array(webcam_points[str(i)])[0:2])

    ground_points_array = np.vstack(ground_points_array)
    webcam_points_array = np.vstack(webcam_points_array)

    return l2_norm(ground_points_array, webcam_points_array)
