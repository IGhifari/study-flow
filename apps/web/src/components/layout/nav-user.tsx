'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarRange,
  ChevronsUpDown,
  LogOut,
  Settings,
} from 'lucide-react';
import { UserProfile } from '@studyflow/shared';
import { apiLogout } from '@/lib/auth-client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface NavUserProps {
  user: UserProfile;
}

export function NavUser({ user }: NavUserProps): React.JSX.Element {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  const getInitials = (name?: string) => {
    if (!name) return 'SF';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={`Menu akun untuk ${user.name}`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[state=collapsed]:!p-0 group-data-[state=collapsed]:justify-center"
            >
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight normal-case group-data-[collapsible=icon]:hidden group-data-[state=collapsed]:hidden">
                <span className="truncate font-semibold normal-case">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground normal-case">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden group-data-[state=collapsed]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal normal-case tracking-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm normal-case">
                <Avatar className="h-8 w-8 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight normal-case">
                  <span className="truncate font-semibold normal-case">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground normal-case">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link
                  href="/settings"
                  onClick={() => setOpenMobile(false)}
                  className="cursor-pointer flex items-center gap-2 text-xs"
                >
                  <Settings className="size-4" />
                  <span>Pengaturan Akun</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/semesters"
                  onClick={() => setOpenMobile(false)}
                  className="cursor-pointer flex items-center gap-2 text-xs"
                >
                  <CalendarRange className="size-4" />
                  <span>Kelola Semester</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive flex items-center gap-2"
            >
              <LogOut className="size-4" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
