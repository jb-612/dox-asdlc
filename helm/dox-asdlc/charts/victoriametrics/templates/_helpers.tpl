{{/*
Expand the name of the chart.
*/}}
{{- define "victoriametrics.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "victoriametrics.fullname" -}}
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
Create the service name (allows override to "metrics-store" for abstraction).
*/}}
{{- define "victoriametrics.serviceName" -}}
{{- if .Values.service.nameOverride }}
{{- .Values.service.nameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- include "victoriametrics.fullname" . }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "victoriametrics.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "victoriametrics.labels" -}}
helm.sh/chart: {{ include "victoriametrics.chart" . }}
{{ include "victoriametrics.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: metrics-store
app.kubernetes.io/part-of: dox-asdlc
{{- end }}

{{/*
Selector labels
*/}}
{{- define "victoriametrics.selectorLabels" -}}
app.kubernetes.io/name: {{ include "victoriametrics.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
vmagent fullname
*/}}
{{- define "victoriametrics.vmagent.fullname" -}}
{{- printf "%s-vmagent" (include "victoriametrics.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
vmagent labels
*/}}
{{- define "victoriametrics.vmagent.labels" -}}
helm.sh/chart: {{ include "victoriametrics.chart" . }}
{{ include "victoriametrics.vmagent.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: metrics-agent
app.kubernetes.io/part-of: dox-asdlc
{{- end }}

{{/*
vmagent selector labels
*/}}
{{- define "victoriametrics.vmagent.selectorLabels" -}}
app.kubernetes.io/name: {{ include "victoriametrics.name" . }}-vmagent
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
