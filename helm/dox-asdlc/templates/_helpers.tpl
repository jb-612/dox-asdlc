{{/*
Expand the name of the chart.
*/}}
{{- define "dox-asdlc.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "dox-asdlc.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "dox-asdlc.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "dox-asdlc.labels" -}}
helm.sh/chart: {{ include "dox-asdlc.chart" . }}
{{ include "dox-asdlc.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.global.labels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "dox-asdlc.selectorLabels" -}}
app.kubernetes.io/name: {{ include "dox-asdlc.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "dox-asdlc.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "dox-asdlc.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Get the namespace to deploy to
Prefers global.namespace if set, otherwise uses Release.Namespace
*/}}
{{- define "dox-asdlc.namespace" -}}
{{- if .Values.global.namespace }}
{{- .Values.global.namespace }}
{{- else }}
{{- .Release.Namespace }}
{{- end }}
{{- end }}

{{/*
Redis secret name
*/}}
{{- define "dox-asdlc.redisSecretName" -}}
{{- printf "%s-redis-auth" (include "dox-asdlc.fullname" .) }}
{{- end }}

{{/*
Git credentials secret name
*/}}
{{- define "dox-asdlc.gitSecretName" -}}
{{- printf "%s-git-credentials" (include "dox-asdlc.fullname" .) }}
{{- end }}

{{/*
API keys secret name
*/}}
{{- define "dox-asdlc.apiKeysSecretName" -}}
{{- printf "%s-api-keys" (include "dox-asdlc.fullname" .) }}
{{- end }}

{{/*
Redis service URL
*/}}
{{- define "dox-asdlc.redisUrl" -}}
{{- printf "redis://redis.%s.svc.cluster.local:6379" (include "dox-asdlc.namespace" .) }}
{{- end }}

{{/*
KnowledgeStore service URL
*/}}
{{- define "dox-asdlc.knowledgeStoreUrl" -}}
{{- printf "http://knowledge-store.%s.svc.cluster.local:8000" (include "dox-asdlc.namespace" .) }}
{{- end }}
