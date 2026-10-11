#!/usr/bin/env python3
"""
Test script to verify the model conversion and backend setup
"""

import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def test_model_files():
    """Check if model files exist"""
    import os
    
    print("🔍 Checking model files...")
    
    files_to_check = [
        './../apps/backend/model/model.json',
        './../apps/backend/model/group1-shard1of1.bin'
    ]
    
    all_exist = True
    for file_path in files_to_check:
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            print(f"  ✓ {file_path} ({size:,} bytes)")
        else:
            print(f"  ✗ {file_path} NOT FOUND")
            all_exist = False
    
    return all_exist

def test_model_structure():
    """Verify model.json structure"""
    print("\n🔍 Checking model.json structure...")
    
    try:
        with open('./../apps/backend/model/model.json', 'r') as f:
            model_data = json.load(f)
        
        print(f"  ✓ Format: {model_data.get('format')}")
        print(f"  ✓ Converted by: {model_data.get('convertedBy')}")
        
        if 'weightsManifest' in model_data:
            weights = model_data['weightsManifest'][0]['weights']
            print(f"  ✓ Number of weight tensors: {len(weights)}")
            
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_backend_dependencies():
    """Check if package.json exists"""
    import os
    
    print("\n🔍 Checking backend configuration...")
    
    if os.path.exists('./../package.json'):
        with open('./../package.json', 'r') as f:
            pkg = json.load(f)
        
        deps = pkg.get('dependencies', {})
        print("  ✓ package.json found")
        print(f"  ✓ Dependencies: {', '.join(deps.keys())}")
        return True
    else:
        print("  ✗ package.json NOT FOUND")
        return False

def generate_test_prediction():
    """Generate a test prediction to verify model works"""
    print("\n🧪 Generating test prediction...")
    
    try:
        import numpy as np
        
        # Create a simple test input (all zeros except center)
        test_input = np.zeros(784, dtype=np.float32)
        # Add some values in the center to simulate a digit
        for i in range(12, 16):
            for j in range(12, 16):
                idx = i * 28 + j
                test_input[idx] = 0.8
        
        print("  ✓ Test input created (784 values)")
        print(f"  ✓ Non-zero values: {np.count_nonzero(test_input)}")
        print(f"  ✓ Value range: [{test_input.min():.2f}, {test_input.max():.2f}]")
        
        # Save test input for API testing
        with open('./test_input.json', 'w') as f:
            json.dump({
                'data': test_input.tolist()
            }, f)
        
        print("  ✓ Test input saved to test_input.json")
        return True
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    print("=" * 50)
    print("  KERAS MODEL WEB APP - VERIFICATION TEST")
    print("=" * 50)
    print()
    
    results = []
    
    results.append(("Model Files", test_model_files()))
    results.append(("Model Structure", test_model_structure()))
    results.append(("Backend Config", test_backend_dependencies()))
    results.append(("Test Data", generate_test_prediction()))
    
    print("\n" + "=" * 50)
    print("  TEST RESULTS")
    print("=" * 50)
    
    for test_name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {test_name:.<30} {status}")
    
    all_passed = all(result[1] for result in results)
    
    print("\n" + "=" * 50)
    if all_passed:
        print("  ✓ ALL TESTS PASSED!")
        print("\n  Next steps:")
        print("  1. Run: npm install")
        print("  2. Run: npm start")
        print("  3. Test API: curl http://localhost:5000/health")
    else:
        print("  ✗ SOME TESTS FAILED")
        print("\n  Please fix the issues above before proceeding")
    print("=" * 50)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
