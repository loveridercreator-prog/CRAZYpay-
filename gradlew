#!/bin/sh

# Standard Gradle Wrapper Script
DEFAULT_JVM_OPTS='"-Xmx64m" "-Xms64m"'

APP_BASE_NAME=`basename "$0"`
APP_HOME=`cd "\`dirname \"$0\"\`" > /dev/null && pwd`

die () {
    echo
    echo "$*"
    echo
    exit 1
}

# Determine the Java command to use to start the JVM.
if [ -n "$JAVA_HOME" ] ; then
    if [ -x "$JAVA_HOME/jre/sh/java" ] ; then
        JAVACMD="$JAVA_HOME/jre/sh/java"
    else
        JAVACMD="$JAVA_HOME/bin/java"
    fi
else
    JAVACMD="java"
fi

CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

if [ -f "$CLASSPATH" ]; then
    exec "$JAVACMD" $DEFAULT_JVM_OPTS -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"
else
    echo "Running Gradle Wrapper..."
fi
