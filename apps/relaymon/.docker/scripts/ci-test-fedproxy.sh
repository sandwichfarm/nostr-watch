#!/bin/bash
#
# CI/CD Test Script for fedproxy connectivity
# This script is designed to be run in CI/CD environments to validate fedproxy connectivity
#

set -e

# --- Variables ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_SCRIPT="${SCRIPT_DIR}/test-fedproxy.sh"
OUTPUT_FILE="/tmp/fedproxy-test-results.txt"
ERROR_LOG="/tmp/fedproxy-test-errors.txt"
TIMEOUT=120  # Time in seconds to wait for services

# --- Configuration ---
TOR_TEST_REQUIRED=${TOR_TEST_REQUIRED:-true}
I2P_TEST_REQUIRED=${I2P_TEST_REQUIRED:-true}
LOKINET_TEST_REQUIRED=${LOKINET_TEST_REQUIRED:-false}

# --- Helper Functions ---
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log_error() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

# --- Run tests with timeout ---
run_tests_with_timeout() {
  log "Starting fedproxy connectivity tests with timeout of ${TIMEOUT}s"
  
  # Run the tests with a timeout
  timeout ${TIMEOUT} ${TEST_SCRIPT} -v > ${OUTPUT_FILE} 2> ${ERROR_LOG} || {
    EXIT_CODE=$?
    if [ ${EXIT_CODE} -eq 124 ]; then
      log_error "Tests timed out after ${TIMEOUT} seconds"
      cat ${ERROR_LOG}
      return 2
    else
      log_error "Tests failed with exit code ${EXIT_CODE}"
      cat ${ERROR_LOG}
      return ${EXIT_CODE}
    fi
  }
  
  # Tests completed, now analyze the results
  return 0
}

# --- Analyze test results ---
analyze_results() {
  local tor_success=false
  local i2p_success=false
  local lokinet_success=false
  local exit_code=0
  
  log "Analyzing test results"
  
  # Check for Tor success
  if grep -q "Tor network is accessible through fedproxy" ${OUTPUT_FILE}; then
    tor_success=true
    log "✅ Tor connectivity: SUCCESS"
  else
    log "❌ Tor connectivity: FAILED"
    if [ "${TOR_TEST_REQUIRED}" = "true" ]; then
      exit_code=1
    fi
  fi
  
  # Check for I2P success
  if grep -q "I2P network is accessible through fedproxy" ${OUTPUT_FILE}; then
    i2p_success=true
    log "✅ I2P connectivity: SUCCESS"
  else
    log "❌ I2P connectivity: FAILED"
    if [ "${I2P_TEST_REQUIRED}" = "true" ]; then
      exit_code=1
    fi
  fi
  
  # Check for Lokinet success
  if grep -q "Lokinet is accessible through fedproxy" ${OUTPUT_FILE}; then
    lokinet_success=true
    log "✅ Lokinet connectivity: SUCCESS"
  elif grep -q "Lokinet not enabled, skipping tests" ${OUTPUT_FILE}; then
    log "ℹ️ Lokinet: SKIPPED (not enabled)"
  else
    log "❌ Lokinet connectivity: FAILED"
    if [ "${LOKINET_TEST_REQUIRED}" = "true" ]; then
      exit_code=1
    fi
  fi
  
  # Summarize results
  log "---------------------------------------------"
  log "Test Summary:"
  log "- Tor: $([ "$tor_success" = true ] && echo "SUCCESS" || echo "FAILED")$([ "${TOR_TEST_REQUIRED}" = "true" ] && echo " (required)" || echo " (optional)")"
  log "- I2P: $([ "$i2p_success" = true ] && echo "SUCCESS" || echo "FAILED")$([ "${I2P_TEST_REQUIRED}" = "true" ] && echo " (required)" || echo " (optional)")"
  log "- Lokinet: $([ "$lokinet_success" = true ] && echo "SUCCESS" || (grep -q "Lokinet not enabled" ${OUTPUT_FILE} && echo "SKIPPED" || echo "FAILED"))$([ "${LOKINET_TEST_REQUIRED}" = "true" ] && echo " (required)" || echo " (optional)")"
  log "---------------------------------------------"
  
  return ${exit_code}
}

# --- Main function ---
main() {
  # Check that the test script exists
  if [ ! -f "${TEST_SCRIPT}" ]; then
    log_error "Test script not found at ${TEST_SCRIPT}"
    exit 1
  fi
  
  # Check that the test script is executable
  if [ ! -x "${TEST_SCRIPT}" ]; then
    log_error "Test script is not executable. Run: chmod +x ${TEST_SCRIPT}"
    exit 1
  fi
  
  # Run the tests
  run_tests_with_timeout
  TEST_RUN_RESULT=$?
  
  # If tests failed to run properly, exit with that code
  if [ ${TEST_RUN_RESULT} -ne 0 ]; then
    log_error "Tests failed to run properly. Exit code: ${TEST_RUN_RESULT}"
    exit ${TEST_RUN_RESULT}
  fi
  
  # Analyze the results
  analyze_results
  ANALYSIS_RESULT=$?
  
  if [ ${ANALYSIS_RESULT} -eq 0 ]; then
    log "✅ All required tests passed!"
  else
    log_error "❌ Some required tests failed!"
    # Show the full test output for debugging
    log "Full test output:"
    cat ${OUTPUT_FILE}
  fi
  
  exit ${ANALYSIS_RESULT}
}

# Run the main function
main 