#!/usr/bin/env python
import os

from flask import Flask, request, jsonify
from src import live_feedback  # import your live feedback analyzer

app = Flask(__name__)

@app.route('/')
def root():
    return "Alive"

@app.route('/analyze', methods=['POST'])
def analyze_pose():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Save the uploaded frame temporarily
    temp_path = "frame.jpg"
    file.save(temp_path)

    # Analyze pose
    feedback = live_feedback.analyze_pose(temp_path)

    # (Optional: clean up the temp file if needed)

    response_data = {
        'feedback': feedback
    }
    return jsonify(response_data), 200

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=os.environ.get("FLASK_SERVER_PORT", 5000), debug=True)
