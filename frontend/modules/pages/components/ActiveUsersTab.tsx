import React from 'react';
import { usePagePresence } from '@shared/hooks/usePagePresence';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/components/ui/card';
import { User, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';


export const ActiveUsersTab = React.memo(() => {
  const location = useLocation();
  const { onlineUsers } = usePagePresence('global', location.pathname);
  const { t } = useTranslation();

  // Filter out users who are inactive or anonymous if needed, but onlineUsers handles uniqueness
  return (
    <Card className="mt-6 border-border/40 shadow-sm bg-card/40 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          {t('activeUsers')}
        </CardTitle>
        <CardDescription>
          {t('activeUsersDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {onlineUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
            <User className="h-8 w-8 opacity-20" />
            <p>{t('noOtherActiveUsers')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {onlineUsers.map((user) => (
              <div 
                key={user.userId} 
                className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-background/50"
              >
                <div 
                  className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold shadow-sm"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="space-y-1 overflow-hidden">
                  <p className="font-semibold text-sm truncate" title={user.name}>
                    {user.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate" dir="ltr" title={user.currentPath || t('dashboardPage')}>
                      {user.currentPath || '/'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

ActiveUsersTab.displayName = 'ActiveUsersTab';
