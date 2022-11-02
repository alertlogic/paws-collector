#!/bin/bash

# Create ps_outputs repository
DIR=".ps_outputs/"
if [[ -d "$DIR" ]]; then
    rm -rf $DIR
fi
mkdir $DIR

showUssage()
{
   echo ""
   echo "Usage: $0 -c [ COVERAGE_FILES ] -b [ UNITESTS_FILES ]"
   echo -e "\t-c List of coverage reports to collect, i.e. '*.coverage.xml,coverage.xml,*.covertool.xml'"
   echo -e "\t-u List of unit test reports to collect, i.e. 'junit.xml,junit_report.xml'"
}

while getopts "c:u:" opt
do
   case "$opt" in
      c ) coverageFiles="$OPTARG" ;;
      u ) unitTestFiles="$OPTARG" ;;
      ? ) showUssage ;;
   esac
done

if [ -z "$coverageFiles" ] && [ -z "$unitTestFiles" ]
then
   echo "Please provide one parameter at least";
   showUssage
   exit 1
fi

# Split coverageFiles and collect
if [ "$coverageFiles" != "" ]; then
    IFS=',' read -r -a coverage_reports <<< "$coverageFiles"
    for element in "${coverage_reports[@]}"
    do
        find . -type f \( -name "$element" \) -exec cp {} .ps_outputs/covertool.xml \;
    done
fi

# Split unitTestFiles and collect
if [ "$unitTestFiles" != "" ]; then
    IFS=',' read -r -a unit_tests <<< "$unitTestFiles"
    for element in "${unit_tests[@]}"
    do
        find . -type f \( -name "$element" \) -exec cp {} .ps_outputs/ \;
    done
fi

# Fail if it does not find any coverage report
if [[ ! -e .ps_outputs/covertool.xml ]]; then
  echo 'No coverage results, changed build result to FAILURE'
  exit 1
fi