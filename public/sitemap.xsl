<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">

  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>XML Sitemap</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 10px 0;
            color: #1a1a1a;
          }
          .intro {
            margin-bottom: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #4CAF50;
            border-radius: 4px;
          }
          .intro p {
            margin: 0;
            color: #666;
          }
          .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            padding: 15px;
            background: #e8f5e9;
            border-radius: 4px;
          }
          .stat {
            flex: 1;
          }
          .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .stat-value {
            font-size: 24px;
            font-weight: 600;
            color: #2e7d32;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            text-align: left;
            padding: 12px;
            background: #f8f9fa;
            border-bottom: 2px solid #dee2e6;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #495057;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #dee2e6;
          }
          tr:hover {
            background: #f8f9fa;
          }
          .url-cell {
            max-width: 500px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .url-cell a {
            color: #1976d2;
            text-decoration: none;
          }
          .url-cell a:hover {
            text-decoration: underline;
          }
          .date-cell {
            color: #666;
            font-size: 13px;
            white-space: nowrap;
          }
          .alternates {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
          }
          .alternates span {
            display: inline-block;
            margin-right: 8px;
            padding: 2px 6px;
            background: #e3f2fd;
            border-radius: 3px;
            color: #1565c0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            font-size: 12px;
            color: #999;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>XML Sitemap</h1>

          <div class="stats">
            <div class="stat">
              <div class="stat-label">Total URLs</div>
              <div class="stat-value">
                <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/>
              </div>
            </div>
            <div class="stat">
              <div class="stat-label">Format</div>
              <div class="stat-value">XML</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>URL</th>
                <th style="width: 180px;">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td style="text-align: center; color: #999;">
                    <xsl:value-of select="position()"/>
                  </td>
                  <td class="url-cell">
                    <a href="{sitemap:loc}" target="_blank">
                      <xsl:value-of select="sitemap:loc"/>
                    </a>
                    <xsl:if test="xhtml:link">
                      <div class="alternates">
                        <xsl:for-each select="xhtml:link">
                          <span>
                            <xsl:value-of select="@hreflang"/>
                          </span>
                        </xsl:for-each>
                      </div>
                    </xsl:if>
                  </td>
                  <td class="date-cell">
                    <xsl:choose>
                      <xsl:when test="sitemap:lastmod">
                        <xsl:value-of select="substring(sitemap:lastmod, 1, 10)"/>
                      </xsl:when>
                      <xsl:otherwise>-</xsl:otherwise>
                    </xsl:choose>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>

