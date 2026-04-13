import org.jenkinsci.plugins.pipeline.modeldefinition.Utils

pipeline {
    agent any
    environment {
        PATH               = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        JENKINS_NODE_COOKIE = 'dontKillMe'
        DEPLOY_TARGET      = 'frontend_staging_web'
        APP_NAME           = 'frontend-template'
        APP_DIR            = '/app'
        CREDENTIAL_ID      = 'deploy-server'
        BUILD_IMAGE        = 'frontend-template-build'
    }
    stages {

        // ─────────────────────────────────────────
        // 1. 빌드 이름/설명 초기화
        // ─────────────────────────────────────────
        stage('Initialization') {
            steps {
                wrap([$class: 'BuildUser']) {
                    buildName "${BUILD_PROJECT_NAME} #${BUILD_NUMBER}"
                    buildDescription "Executed By ${BUILD_USER_ID}"
                }
            }
        }

        // ─────────────────────────────────────────
        // 2. 소스 체크아웃
        // ─────────────────────────────────────────
        stage('Source Checkout') {
            steps {
                sh "rm -rf ${WORKSPACE}/${BUILD_PROJECT_NAME}"
                sh "mkdir -p ${BUILD_PROJECT_NAME}"
                dir("${BUILD_PROJECT_NAME}") {
                    git branch: '${CST_GIT_BRANCH}',
                        credentialsId: 'deployer',
                        url: 'https://github.com/kst13/frontend-template.git'
                }
            }
        }

        // ─────────────────────────────────────────
        // 3. Docker 컨테이너 내 Vite 빌드
        //    - 인라인 Dockerfile로 Node 이미지 생성
        //    - 볼륨 마운트로 dist/ 산출물을 워크스페이스에 수집
        // ─────────────────────────────────────────
        stage('Build') {
            steps {
                dir("${BUILD_PROJECT_NAME}") {
                    sh '''
                        DOCKERFILE_NAME=Dockerfile.build
                        cat > ${DOCKERFILE_NAME} <<'EOF'
                        FROM node:20-slim
                        WORKDIR /workspace
                        RUN npm install -g vite
                        COPY package.json package-lock.json ./
                        RUN npm ci
                        COPY . .
                        CMD npm run build
                        EOF
                        chmod -R 755 ./*

                        # 빌드 이미지 생성
                        docker build --no-cache -f ${DOCKERFILE_NAME} -t ${BUILD_IMAGE}:${BUILD_NUMBER} .

                        # 컨테이너 실행 → dist/ 를 워크스페이스로 마운트
                        mkdir -p $(pwd)/dist
                        docker run --rm \
                            -v $(pwd):/workspace \
                            --user $(id -u):$(id -g) \
                            ${BUILD_IMAGE}:${BUILD_NUMBER}

                        # 임시 이미지 삭제
                        docker rmi ${BUILD_IMAGE}:${BUILD_NUMBER} || true
                    '''
                }
            }
        }

        // ─────────────────────────────────────────
        // 4. 배포 전 산출물 검증
        // ─────────────────────────────────────────
        stage('Pre-Deploy Validation') {
            when {
                expression { return "${DEPLOY_YN}" != "No" }
            }
            steps {
                dir("${BUILD_PROJECT_NAME}/dist") {
                    script {
                        if (!fileExists('index.html')) {
                            error "Build artifact validation failed: index.html not found in dist/"
                        }
                        echo "Build artifact validation passed."
                    }
                }
            }
        }

        // ─────────────────────────────────────────
        // 5. 배포 (백업 → 전송 → Atomic 전환 → 검증 → 롤백)
        // ─────────────────────────────────────────
        stage('Deploy') {
            when {
                expression { return "${DEPLOY_YN}" != "No" }
            }
            steps {
                script {
                    dir("${BUILD_PROJECT_NAME}/dist") {
                        withCredentials([sshUserPrivateKey(
                            credentialsId: "${CREDENTIAL_ID}",
                            keyFileVariable: 'identity',
                            passphraseVariable: 'passphrase',
                            usernameVariable: 'userName'
                        )]) {
                            def remote = [:]
                            remote.name         = 'deploy-server'
                            remote.allowAnyHosts = true
                            remote.user          = userName
                            remote.identityFile  = identity
                            remote.host          = "${DEPLOY_TARGET}"

                            // 1) 기존 배포본 백업
                            sshCommand remote: remote, command: """
                                BACKUP_DIR=${APP_DIR}/${APP_NAME}_backup_${BUILD_NUMBER}
                                if [ -d ${APP_DIR}/${APP_NAME} ]; then
                                    echo '[Backup] Creating backup at '\${BACKUP_DIR}
                                    cp -a ${APP_DIR}/${APP_NAME} \${BACKUP_DIR}
                                else
                                    echo '[Backup] No existing deployment found, skipping backup.'
                                fi
                            """

                            // 2) 새 빌드 산출물 전송 (임시 디렉토리)
                            sshCommand remote: remote, command: "rm -rf ${APP_DIR}/${APP_NAME}_new && mkdir -p ${APP_DIR}/${APP_NAME}_new"
                            sshPut remote: remote, from: '.', into: "${APP_DIR}/${APP_NAME}_new"

                            // 3) Atomic 전환
                            sshCommand remote: remote, command: """
                                set -e
                                echo '[Deploy] Atomic swap start'
                                cd ${APP_DIR}

                                # sshPut이 dist/ 안 내용을 넣으므로 정리
                                if [ -d ${APP_NAME}_new/dist ]; then
                                    mv ${APP_NAME}_new/dist ${APP_NAME}_staged
                                    rm -rf ${APP_NAME}_new
                                else
                                    mv ${APP_NAME}_new ${APP_NAME}_staged
                                fi

                                [ -d ${APP_NAME} ] && mv ${APP_NAME} ${APP_NAME}_old
                                mv ${APP_NAME}_staged ${APP_NAME}
                                rm -rf ${APP_NAME}_old
                                echo '[Deploy] Atomic swap complete'
                            """

                            // 4) 배포 후 검증
                            def verifyResult = sshCommand remote: remote, command: """
                                if [ -f ${APP_DIR}/${APP_NAME}/index.html ]; then
                                    echo 'DEPLOY_VERIFY_OK'
                                else
                                    echo 'DEPLOY_VERIFY_FAIL'
                                fi
                            """, returnStdout: true

                            if (!verifyResult.contains('DEPLOY_VERIFY_OK')) {
                                echo "[Rollback] Post-deploy verification failed. Initiating rollback..."
                                sshCommand remote: remote, command: """
                                    set -e
                                    BACKUP_DIR=${APP_DIR}/${APP_NAME}_backup_${BUILD_NUMBER}
                                    if [ -d \${BACKUP_DIR} ]; then
                                        rm -rf ${APP_DIR}/${APP_NAME}
                                        mv \${BACKUP_DIR} ${APP_DIR}/${APP_NAME}
                                        echo '[Rollback] Restored from backup successfully.'
                                    else
                                        echo '[Rollback] ERROR: No backup found!'
                                    fi
                                """
                                error "Deployment verification failed and rollback was executed."
                            }

                            echo "[Deploy] Verification passed. Cleaning old backups (keep last 3)..."

                            // 5) 오래된 백업 정리 (최근 3개만 유지)
                            sshCommand remote: remote, command: """
                                cd ${APP_DIR}
                                ls -dt ${APP_NAME}_backup_* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
                            """
                        }
                    }
                }
            }
        }

        // ─────────────────────────────────────────
        // 6. 웹 서버(Nginx 등) 재시작 및 헬스체크
        // ─────────────────────────────────────────
        stage('Restart') {
            when {
                expression { return "${RESTART_SERVER_YN}" != "No" && "${DEPLOY_YN}" != "No" }
            }
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: "${CREDENTIAL_ID}",
                        keyFileVariable: 'identity',
                        passphraseVariable: 'passphrase',
                        usernameVariable: 'userName'
                    )]) {
                        def remote = [:]
                        remote.name         = 'deploy-server'
                        remote.allowAnyHosts = true
                        remote.user          = userName
                        remote.identityFile  = identity
                        remote.host          = "${DEPLOY_TARGET}"

                        sshCommand remote: remote, command: "docker restart ${APP_NAME}-web"

                        sleep(5)

                        def containerStatus = sshCommand remote: remote, command: """
                            docker inspect --format='{{.State.Running}}' ${APP_NAME}-web 2>/dev/null || echo 'false'
                        """, returnStdout: true

                        if (!containerStatus.contains('true')) {
                            echo "[Rollback] Container restart failed. Rolling back deployment..."
                            sshCommand remote: remote, command: """
                                set -e
                                BACKUP_DIR=\$(ls -dt ${APP_DIR}/${APP_NAME}_backup_* 2>/dev/null | head -1)
                                if [ -n "\${BACKUP_DIR}" ]; then
                                    rm -rf ${APP_DIR}/${APP_NAME}
                                    cp -a \${BACKUP_DIR} ${APP_DIR}/${APP_NAME}
                                    docker restart ${APP_NAME}-web || true
                                    echo '[Rollback] Deployment rolled back and container restarted.'
                                else
                                    echo '[Rollback] ERROR: No backup available for rollback!'
                                fi
                            """
                            error "Container health check failed after restart. Rollback executed."
                        }

                        echo "[Restart] Container is running normally."
                    }
                }
            }
        }
    }

    post {
        failure {
            script {
                echo "=========================================="
                echo " Pipeline FAILED: ${BUILD_PROJECT_NAME} #${BUILD_NUMBER}"
                echo "=========================================="
                // slackSend channel: '#deploy-alert', message: "FAILED: ${BUILD_PROJECT_NAME} #${BUILD_NUMBER}"
            }
        }
        success {
            script {
                echo "=========================================="
                echo " Pipeline SUCCESS: ${BUILD_PROJECT_NAME} #${BUILD_NUMBER}"
                echo "=========================================="
                // slackSend channel: '#deploy-alert', message: "SUCCESS: ${BUILD_PROJECT_NAME} #${BUILD_NUMBER}"
            }
        }
        always {
            // 빌드 이미지 잔존 시 정리
            sh "docker rmi ${BUILD_IMAGE}:${BUILD_NUMBER} 2>/dev/null || true"
        }
    }
}
